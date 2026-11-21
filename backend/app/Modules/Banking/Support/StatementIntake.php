<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Data\ParsedStatement;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\ImportFormat;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\Parsers\CamtStatementParser;
use App\Modules\Banking\Support\Parsers\CsvStatementParser;

/**
 * Lit un fichier déposé pour un compte : contrôle du contenu, analyse, puis cohérence avec le compte choisi
 * (identifiant du relevé, devise). Commun à l'aperçu et à l'import.
 */
final readonly class StatementIntake
{
    public function __construct(
        private Fingerprinter $empreintes,
        private CsvStatementParser $csv,
        private CamtStatementParser $camt,
    ) {}

    /**
     * @param  array<string, mixed>|null  $profil
     * @return array{file: StatementFile, statement: ParsedStatement, profile: array<string, mixed>|null}
     */
    public function handle(OrganizationBankAccount $compte, string $chemin, ImportFormat $format, ?array $profil): array
    {
        $profil ??= $compte->csv_profile;
        $encodage = is_array($profil) && ($profil['encoding'] ?? null) === 'Windows-1252' ? 'Windows-1252' : 'UTF-8';
        $fichier = StatementFile::read($chemin, $format->isXml(), $encodage);
        $max = (int) config('banking.import_max_lines');
        $devise = $compte->currency;

        if ($format === ImportFormat::Csv) {
            if ($profil === null) {
                throw ErrorCode::StatementInvalid->problem("Aucun profil CSV n'est défini pour ce compte.");
            }

            $releve = $this->csv->parse($fichier->text, $profil, $devise, $max);
        } else {
            $releve = $this->camt->parse($fichier->text, $max);

            if ($releve->accountIdentifier === null || ! hash_equals($compte->identifier_hash, $this->empreintes->account($releve->accountIdentifier))) {
                throw ErrorCode::StatementAccountMismatch->problem();
            }
        }

        if (($releve->currency !== null && $releve->currency !== $devise) || array_filter($releve->lines, static fn ($l): bool => $l->currency !== $devise) !== []) {
            throw ErrorCode::AccountCurrencyUnsupported->problem();
        }

        return ['file' => $fichier, 'statement' => $releve, 'profile' => $profil];
    }
}
