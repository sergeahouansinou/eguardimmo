<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Data\ParsedLine;
use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\ImportFormat;
use App\Modules\Banking\Jobs\ComputeBankSuggestions;
use App\Modules\Banking\Models\BankStatement;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\Fingerprinter;
use App\Modules\Banking\Support\Idempotency;
use App\Modules\Banking\Support\LineDeduplicator;
use App\Modules\Banking\Support\StatementIntake;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Import d'un relevé : fichier contrôlé, stocké par Documents, relevé et lignes écrits en une transaction. Les propositions
 * sont calculées ensuite par un job. Une ligne refusée est rapportée par son numéro, jamais par son contenu.
 */
final readonly class ImportStatement
{
    private const CHUNK = 400;

    public function __construct(
        private StatementIntake $lecture,
        private LineDeduplicator $doublons,
        private Fingerprinter $empreintes,
        private Idempotency $idempotence,
        private DocumentStore $documents,
        private PartyBankAccounts $parties,
        private RecordAudit $audit,
        private CurrentOrganization $organisation,
    ) {}

    /**
     * @param  array<string, mixed>|null  $profil
     * @return array{statement: BankStatement, created: bool, rejected: list<array{line: int, code: string}>}
     */
    public function handle(string $accountId, string $chemin, ImportFormat $format, ?array $profil, string $userId, string $cle): array
    {
        $compte = OrganizationBankAccount::query()->find($accountId) ?? throw ErrorCode::AccountNotFound->problem();

        if ($compte->status !== AccountStatus::Active) {
            throw ErrorCode::AccountClosed->problem();
        }

        ['file' => $fichier, 'statement' => $releve, 'profile' => $profilUtilise] = $this->lecture->handle($compte, $chemin, $format, $profil);
        $empreinte = hash('sha256', (string) json_encode(['import', $accountId, $format->value, $fichier->sha256, $format === ImportFormat::Csv ? $profilUtilise : null]));
        $cree = false;

        $resultat = DB::transaction(function () use ($accountId, $fichier, $releve, $format, $userId, $cle, $empreinte, &$cree): array {
            $compte = $this->verrouiller($accountId);

            return $this->idempotence->run($cle, $empreinte, function () use ($compte, $accountId, $fichier, $releve, $format, $userId, $cle, $empreinte, &$cree): array {
                $existant = BankStatement::query()->where('bank_account_id', $accountId)->where('file_sha256', $fichier->sha256)->first();

                if ($existant !== null) {
                    return ['type' => 'bank_statement', 'id' => $existant->id];
                }

                $cree = true;
                $id = (string) Str::uuid7();
                $cles = $this->doublons->keys($accountId, $releve->lines);
                $rangs = $releve->isCopy ? array_fill(0, count($cles), null) : $this->doublons->occurrences($cles, $this->doublons->known($accountId, array_column($cles, 'key')));
                $importees = count(array_filter($rangs, static fn (?int $r): bool => $r !== null));

                $stocke = $this->documents->store(
                    FileSource::contents($fichier->raw),
                    'releve-bancaire-'.$releve->periodTo->format('Ymd').'.'.($format === ImportFormat::Csv ? 'csv' : 'xml'),
                    FileCategory::BankStatement,
                    new DocumentSubject('bank_statement', $id),
                    CarbonImmutable::now()->addYears((int) config('banking.retention_years')),
                );

                $maintenant = now();
                $devise = $compte->currency;

                DB::table('bank_statements')->insert([
                    'id' => $id, 'organization_id' => $this->organisation->id(), 'bank_account_id' => $accountId,
                    'source' => $releve->source->value, 'format_version' => $releve->formatVersion, 'stored_file_id' => $stocke->id,
                    'file_sha256' => $fichier->sha256, 'statement_ref' => $releve->reference, 'sequence' => $releve->sequence,
                    'period_from' => $releve->periodFrom->toDateString(), 'period_to' => $releve->periodTo->toDateString(),
                    'opening_balance' => $releve->openingBalance, 'closing_balance' => $releve->closingBalance, 'currency' => $devise,
                    'lines_total' => count($releve->lines), 'lines_imported' => $importees, 'lines_duplicated' => count($releve->lines) - $importees,
                    'lines_rejected' => count($releve->rejected), 'is_copy' => $releve->isCopy, 'idempotency_key' => $cle, 'fingerprint' => $empreinte,
                    'imported_by_user_id' => $userId, 'created_at' => $maintenant, 'updated_at' => $maintenant,
                ]);

                $this->insertLines($id, $accountId, $devise, $releve->lines, $cles, $rangs);

                $this->audit->handle('banking.statement.imported', subject: BankStatement::query()->findOrFail($id), metadata: [
                    'format' => $format->value, 'lines_total' => count($releve->lines), 'lines_imported' => $importees,
                    'lines_duplicated' => count($releve->lines) - $importees, 'lines_rejected' => count($releve->rejected), 'is_copy' => $releve->isCopy,
                ]);

                return ['type' => 'bank_statement', 'id' => $id];
            });
        });

        $statement = BankStatement::query()->findOrFail($resultat['id']);

        if ($cree && $statement->lines_imported > 0) {
            ComputeBankSuggestions::dispatch($this->organisation->id(), $statement->id)->afterCommit();
        }

        return ['statement' => $statement, 'created' => $cree, 'rejected' => $cree ? $releve->rejected : []];
    }

    /**
     * Le verrou du compte précède toute lecture de la transaction : sous REPEATABLE READ, une lecture antérieure figerait une vue
     * qui ignore l'import concurrent déjà validé, et les doublons ne seraient plus vus.
     */
    private function verrouiller(string $accountId): OrganizationBankAccount
    {
        $compte = OrganizationBankAccount::query()->lockForUpdate()->find($accountId) ?? throw ErrorCode::AccountNotFound->problem();

        if ($compte->status !== AccountStatus::Active) {
            throw ErrorCode::AccountClosed->problem();
        }

        return $compte;
    }

    /**
     * @param  list<ParsedLine>  $lignes
     * @param  list<array{key: string, rank: int}>  $cles
     * @param  list<int|null>  $rangs
     */
    private function insertLines(string $statementId, string $accountId, string $devise, array $lignes, array $cles, array $rangs): void
    {
        $maintenant = now();
        $lot = [];
        $ibans = [];

        foreach ($lignes as $i => $ligne) {
            if ($rangs[$i] === null) {
                continue;
            }

            $hash = null;
            $last4 = null;

            if ($ligne->counterpartyIdentifier !== null && preg_match('/^[A-Za-z0-9 -]{4,40}$/D', $ligne->counterpartyIdentifier) === 1) {
                $hash = $this->empreintes->counterparty($ligne->counterpartyIdentifier);
                $last4 = Fingerprinter::last4($ligne->counterpartyIdentifier);
                $ibans[$hash] = $ligne->counterpartyIdentifier;
            }

            $lot[] = [
                'id' => (string) Str::uuid7(), 'organization_id' => $this->organisation->id(), 'statement_id' => $statementId, 'bank_account_id' => $accountId,
                'line_number' => $ligne->number, 'booking_date' => $ligne->bookingDate->toDateString(), 'value_date' => $ligne->valueDate?->toDateString(),
                'direction' => $ligne->direction->value, 'amount' => $ligne->amount, 'currency' => $devise,
                'original_amount' => $ligne->originalAmount, 'original_currency' => $ligne->originalCurrency, 'reversal' => $ligne->reversal,
                'bank_reference' => $ligne->bankReference, 'end_to_end_id' => $ligne->endToEndId, 'transaction_code' => $ligne->transactionCode,
                'label' => $ligne->label, 'remittance_reference' => $ligne->remittanceReference, 'counterparty_name' => $ligne->counterpartyName,
                'counterparty_hash' => $hash, 'counterparty_last4' => $last4, 'dedup_key' => $cles[$i]['key'], 'occurrence' => $rangs[$i],
                'state' => 'unmatched', 'ignore_reason' => null, 'lock_version' => 1, 'created_at' => $maintenant, 'updated_at' => $maintenant,
            ];

            if (count($lot) === self::CHUNK) {
                DB::table('bank_statement_lines')->insert($lot);
                $lot = [];
            }
        }

        if ($lot !== []) {
            DB::table('bank_statement_lines')->insert($lot);
        }

        $this->linkCounterparties($ibans);
    }

    /**
     * @param  array<string, string>  $ibans  IBAN de contrepartie par empreinte
     */
    private function linkCounterparties(array $ibans): void
    {
        if ($ibans === []) {
            return;
        }

        $parHash = [];

        foreach ($this->parties->partiesByIban(array_values($ibans)) as $iban => $partyIds) {
            $parHash[$this->empreintes->counterparty($iban)] = $partyIds;
        }

        $maintenant = now();

        foreach ($parHash as $hash => $partyIds) {
            foreach ($partyIds as $partyId) {
                DB::table('bank_counterparty_links')->insertOrIgnore([
                    'id' => (string) Str::uuid7(), 'organization_id' => $this->organisation->id(), 'counterparty_hash' => $hash, 'party_id' => $partyId,
                    'origin' => 'parties', 'confirmations' => 0, 'created_at' => $maintenant, 'updated_at' => $maintenant,
                ]);
            }
        }
    }
}
