<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\GeneratedFile;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\PublicApi\Bundles;
use App\Modules\Documents\PublicApi\IssuedDocuments;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Enums\SequenceKind;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Recovery\Queries\OutstandingAmounts;
use App\Modules\Recovery\Support\BundleDocuments;
use App\Modules\Recovery\Support\Currencies;
use App\Modules\Recovery\Support\Numbers;
use App\Modules\Recovery\Support\PdfRenderer;
use App\Modules\Recovery\Support\PieceHtml;
use App\Modules\Recovery\Support\Snapshots;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class GenerateBundle
{
    private const int ESSAIS = 3;

    public function __construct(
        private LeaseDirectory $baux,
        private LeaseParticipants $participants,
        private PartyDirectory $parties,
        private LedgerReader $grandLivre,
        private OutstandingAmounts $restesDus,
        private BundleDocuments $documents,
        private IssuedDocuments $pieces,
        private Bundles $archives,
        private Numbers $numeros,
        private Snapshots $instantanes,
        private PieceHtml $html,
        private PdfRenderer $pdf,
        private RecordAudit $audit,
    ) {}

    /**
     * Réunit les pièces du dossier en un ZIP stocké par Documents (empreinte SHA-256) : décompte (pièce émise), avis
     * d'échéance des créances, fiche du bail et extrait du grand livre. La liste des pièces et le décompte sont figés
     * en JSON (ADR 0022). Le PDF vient de Gotenberg : les trois rendus se font avant toute transaction, sous le numéro
     * d'envoi attendu ; s'il tombe, rien n'est écrit. Le numéro et l'état du dossier sont revérifiés sous verrou : si une
     * génération concurrente est passée entre-temps, le rendu est refait (trois essais).
     */
    public function handle(RecoveryCase $case, CarbonImmutable $today): RecoveryBundle
    {
        for ($essai = 1; ; $essai++) {
            try {
                return $this->tenter($case, $today);
            } catch (ApiProblem $probleme) {
                if ($probleme->problemCode !== ErrorCode::BundleConflict->value || $essai >= self::ESSAIS) {
                    throw $probleme;
                }
            }
        }
    }

    private function tenter(RecoveryCase $case, CarbonImmutable $today): RecoveryBundle
    {
        $dossier = RecoveryCase::query()->findOrFail($case->id);

        if (! $dossier->status->isActive()) {
            throw ErrorCode::CaseNotActive->problem();
        }

        /** @var list<RecoveryCaseItem> $creances */
        $creances = array_values($dossier->activeItems()->get()->all());

        if ($creances === []) {
            throw ErrorCode::CaseEmpty->problem();
        }

        $devise = Currencies::of($dossier->currency);
        $ids = array_map(fn (RecoveryCaseItem $c): string => $c->item_id, $creances);
        $restes = $this->restesDus->of($creances);

        if (array_filter($restes, fn (Money $reste): bool => $reste->isPositive()) === []) {
            throw ErrorCode::NothingDue->problem();
        }

        $numero = $this->numeros->peek(SequenceKind::Bundle, $today);
        $bail = $this->baux->find($dossier->lease_id);
        $debiteur = $this->parties->find($dossier->debtor_party_id);
        $lignesBail = $this->participants->partiesOf($bail->id);
        $partiesDuBail = $this->parties->findMany(array_values(array_unique(array_map(fn ($l): string => $l->partyId, $lignesBail))));
        $debut = CarbonImmutable::parse(min(array_map(fn (RecoveryCaseItem $c): string => $c->period_start->toDateString(), $creances)));
        $releve = $this->grandLivre->leaseStatement($bail->id, $devise, $debut, $today);
        $pieces = $this->documents->of($creances);
        $decompte = $this->instantanes->statement($dossier, $numero, $bail, $debiteur, $creances, $restes, $today);

        $pdfDecompte = $this->pdf->render($this->html->render('statement', $decompte));
        $fiche = $this->pdf->render($this->html->render('lease', $this->instantanes->lease($dossier, $bail, $lignesBail, $partiesDuBail, $today)));
        $extrait = $this->pdf->render($this->html->render('ledger', $this->instantanes->ledger($dossier, $bail, $releve, $today)));

        $nomDecompte = "decompte-{$numero}.pdf";
        $nomFiche = "fiche-bail-{$bail->reference}.pdf";
        $nomExtrait = "extrait-grand-livre-{$bail->reference}.pdf";
        $sujet = new DocumentSubject('lease', $bail->id);
        $idsTries = $ids;
        sort($idsTries);

        // Le ZIP est stocké dans la transaction, avant la prise des verrous : un échec ultérieur retire ligne et fichier avec elle.
        return DB::transaction(function () use ($dossier, $today, $numero, $decompte, $pdfDecompte, $fiche, $extrait, $pieces, $nomDecompte, $nomFiche, $nomExtrait, $sujet, $idsTries, $bail): RecoveryBundle {
            $zip = $this->archives->zip(
                $pieces['files'],
                [new GeneratedFile($nomDecompte, $pdfDecompte), new GeneratedFile($nomFiche, $fiche), new GeneratedFile($nomExtrait, $extrait)],
                "dossier-{$dossier->number}-{$numero}",
                $sujet,
            );

            $courant = RecoveryCase::query()->whereKey($dossier->id)->lockForUpdate()->firstOrFail();

            if (! $courant->status->isActive()) {
                throw ErrorCode::CaseNotActive->problem();
            }

            $actuels = $courant->activeItems()->pluck('item_id')->all();
            sort($actuels);

            if ($actuels !== $idsTries || $this->numeros->next(SequenceKind::Bundle, $today) !== $numero) {
                throw ErrorCode::BundleConflict->problem();
            }

            $emis = $this->pieces->issue(new NewIssuedDocumentData(
                IssuedDocumentType::DebtStatement,
                $decompte,
                Snapshots::TEMPLATE_VERSION,
                FileSource::contents($pdfDecompte),
                $nomDecompte,
                $sujet,
            ));

            $piecesLignes = [
                ['kind' => 'statement', 'label' => 'Décompte des sommes dues', 'number' => $emis->number, 'file_name' => $emis->file->displayName, 'sha256' => $emis->fingerprint, 'item_id' => null],
                ...$pieces['pieces'],
                ['kind' => 'lease', 'label' => 'Fiche du bail', 'number' => $bail->reference, 'file_name' => $nomFiche, 'sha256' => hash('sha256', $fiche), 'item_id' => null],
                ['kind' => 'ledger_extract', 'label' => 'Extrait du grand livre', 'number' => null, 'file_name' => $nomExtrait, 'sha256' => hash('sha256', $extrait), 'item_id' => null],
            ];

            $envoi = RecoveryBundle::query()->create([
                'case_id' => $dossier->id,
                'number' => $numero,
                'stored_file_id' => $zip->id,
                'sha256' => $zip->sha256,
                'size_bytes' => $zip->sizeBytes,
                'pieces' => $piecesLignes,
                'statement' => $decompte,
                'currency' => $dossier->currency,
                'total_due' => new Money($decompte['totals']['outstanding'], Currencies::of($dossier->currency)),
                'generated_on' => Carbon::instance($today),
                'generated_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);

            $this->audit->handle('recovery.bundle.generated', subject: $envoi, metadata: ['number' => $numero, 'case' => $dossier->number, 'pieces' => count($piecesLignes), 'sha256' => $zip->sha256]);

            return $envoi;
        });
    }
}
