<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Data\ParsedLine;
use App\Modules\Banking\Data\ParsedStatement;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\ImportFormat;
use App\Modules\Banking\Models\BankStatement;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\LineDeduplicator;
use App\Modules\Banking\Support\StatementIntake;

/**
 * Aperçu avant import : les premières lignes lues avec le profil, les lignes refusées par numéro, ce qui serait importé ou dédoublonné.
 * Rien n'est écrit.
 */
final readonly class PreviewStatement
{
    public function __construct(private StatementIntake $lecture, private LineDeduplicator $doublons) {}

    /**
     * @param  array<string, mixed>|null  $profil
     * @return array{statement: ParsedStatement, preview: list<ParsedLine>, would_import: int, would_duplicate: int, already_imported: bool}
     */
    public function handle(string $accountId, string $chemin, ImportFormat $format, ?array $profil): array
    {
        $compte = OrganizationBankAccount::query()->find($accountId) ?? throw ErrorCode::AccountNotFound->problem();
        ['file' => $fichier, 'statement' => $releve] = $this->lecture->handle($compte, $chemin, $format, $profil);
        $cles = $this->doublons->keys($accountId, $releve->lines);
        $rangs = $releve->isCopy ? array_fill(0, count($cles), null) : $this->doublons->occurrences($cles, $this->doublons->known($accountId, array_column($cles, 'key')));
        $importees = count(array_filter($rangs, static fn (?int $r): bool => $r !== null));

        return [
            'statement' => $releve,
            'preview' => array_slice($releve->lines, 0, (int) config('banking.preview_lines')),
            'would_import' => $importees,
            'would_duplicate' => count($releve->lines) - $importees,
            'already_imported' => BankStatement::query()->where('bank_account_id', $accountId)->where('file_sha256', $fichier->sha256)->exists(),
        ];
    }
}
