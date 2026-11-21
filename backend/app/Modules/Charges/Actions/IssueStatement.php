<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Events\ChargeStatementIssued;
use App\Modules\Charges\Jurisdictions\ChargeRulesRegistry;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\StatementEffects;
use App\Modules\Charges\Support\StatementFiles;
use App\Modules\Charges\Support\StatementNumbers;
use App\Modules\Charges\Support\StatementPdf;
use App\Modules\Charges\Support\StatementSnapshot;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\PublicApi\IssuedDocuments;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Deux courtes transactions par bail, le rendu PDF entre les deux hors de tout verrou (ADR 0034 § 6). La première fige le numéro, l'effet sur le
 * compte du locataire et l'instantané, et les laisse attachés au décompte (qui reste `computed` ou `failed`) ; la seconde crée la pièce Documents et
 * passe le décompte `issued`. Une panne du rendu ne perd donc jamais le numéro (pas de trou) et la reprise saute la première phase : aucun second effet.
 */
final readonly class IssueStatement
{
    public function __construct(
        private Locks $verrous,
        private ChargeRulesRegistry $juridictions,
        private StatementNumbers $numeros,
        private StatementEffects $effets,
        private StatementSnapshot $instantanes,
        private StatementPdf $pdf,
        private StatementFiles $pieces,
        private IssuedDocuments $documents,
        private LeaseDirectory $baux,
        private RecordAudit $audit,
    ) {}

    public function handle(string $statementId): ChargeStatement
    {
        $exerciceId = ChargeStatement::query()->whereKey($statementId)->value('exercise_id');

        if (! is_string($exerciceId)) {
            throw ErrorCode::StatementNotFound->problem();
        }

        $fige = DB::transaction(fn (): ChargeStatement => $this->freeze($statementId, $exerciceId));

        if ($fige->status === StatementStatus::Issued) {
            return $fige;
        }

        $contenu = $this->pdf->render($fige->snapshot);

        return DB::transaction(fn (): ChargeStatement => $this->complete($statementId, $exerciceId, $contenu));
    }

    private function freeze(string $statementId, string $exerciceId): ChargeStatement
    {
        $exercice = $this->verrous->exerciseOfProperty($exerciceId);
        $decompte = $this->verrous->statement($statementId);

        if ($decompte->status === StatementStatus::Issued || $decompte->number !== null) {
            return $this->assertIssuable($decompte, $exercice);
        }

        $this->assertIssuable($decompte, $exercice);
        $aujourdhui = CarbonImmutable::today();
        $regles = $this->juridictions->for($exercice->jurisdiction);
        $remplace = $decompte->supersedes_id === null ? null : $this->verrous->statement($decompte->supersedes_id);
        $delta = (int) $decompte->balance->getAmount() - ($remplace === null ? 0 : (int) $remplace->balance->getAmount());
        $bail = $this->baux->find($decompte->lease_id);
        $debut = CarbonImmutable::parse($exercice->period_start);
        $fin = CarbonImmutable::parse($exercice->period_end);

        $numero = $this->numeros->next($aujourdhui);
        $effet = $this->effets->apply($decompte, $regles, $delta, $bail->units[0]->unitId, $aujourdhui, $debut, $fin);
        $instantane = $this->instantanes->build($decompte, $exercice, $regles, $numero, $aujourdhui, $remplace?->number, $effet['settlement']->value, $effet['not_before']);

        $decompte->forceFill([
            'number' => $numero, 'settlement' => $effet['settlement'], 'not_before' => $effet['not_before'], 'snapshot' => $instantane,
            'template_version' => $regles->templateVersion(), 'lock_version' => $decompte->lock_version + 1,
        ])->save();

        return $decompte;
    }

    private function complete(string $statementId, string $exerciceId, string $contenu): ChargeStatement
    {
        $exercice = $this->verrous->exerciseOfProperty($exerciceId);
        $decompte = $this->verrous->statement($statementId);

        if ($decompte->status === StatementStatus::Issued) {
            return $decompte;
        }

        $this->assertIssuable($decompte, $exercice);
        $numero = (string) $decompte->number;
        $remplace = $decompte->supersedes_id === null ? null : $this->verrous->statement($decompte->supersedes_id);
        $piece = $this->documents->issue(new NewIssuedDocumentData(
            IssuedDocumentType::ChargesRegularization,
            $decompte->snapshot,
            $decompte->template_version,
            FileSource::contents($contenu),
            "decompte-charges-{$numero}.pdf",
            new DocumentSubject('lease', $decompte->lease_id),
            CarbonImmutable::today()->addYears((int) config('charges.accounting_retention_years')),
        ));

        $decompte->forceFill([
            'status' => StatementStatus::Issued, 'issued_document_id' => $piece->id, 'stored_file_id' => $piece->file->id,
            'issued_at' => Carbon::now(), 'failure_reason' => null, 'lock_version' => $decompte->lock_version + 1,
        ])->save();

        $remplace?->forceFill(['status' => StatementStatus::Superseded, 'lock_version' => $remplace->lock_version + 1])->save();
        $this->pieces->attach($decompte);
        $this->audit->handle('charges.statement.issued', subject: $decompte, metadata: ['number' => $numero, 'settlement' => $decompte->settlement?->value, 'supersedes' => $remplace?->id]);
        ChargeStatementIssued::dispatch($decompte->id, $decompte->lease_id, $decompte->organization_id);

        return $decompte;
    }

    private function assertIssuable(ChargeStatement $decompte, ChargeExercise $exercice): ChargeStatement
    {
        if ($decompte->status === StatementStatus::Issued) {
            return $decompte;
        }

        if (! in_array($decompte->status, [StatementStatus::Computed, StatementStatus::Failed], true) || $exercice->status !== ExerciseStatus::Issuing) {
            throw ErrorCode::StatementStateInvalid->problem();
        }

        return $decompte;
    }
}
