<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Data\ParsedLine;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

/**
 * Clé de dédoublonnage d'une ligne : HMAC de (compte, référence bancaire) quand la banque la donne, sinon de (compte, dates, sens,
 * montant, libellé normalisé, bout en bout). Seul l'excédent d'occurrences sur les lignes déjà connues est importé.
 */
final readonly class LineDeduplicator
{
    public function __construct(private Fingerprinter $empreintes, private CurrentOrganization $organisation) {}

    /**
     * Pour chaque ligne du fichier, dans l'ordre : sa clé et son rang d'occurrence dans le fichier.
     *
     * @param  list<ParsedLine>  $lignes
     * @return list<array{key: string, rank: int}>
     */
    public function keys(string $accountId, array $lignes): array
    {
        $vus = [];
        $resultat = [];

        foreach ($lignes as $ligne) {
            $cle = $ligne->bankReference !== null
                ? $this->empreintes->lineKey($accountId, 'ref', $ligne->bankReference)
                : $this->empreintes->lineKey(
                    $accountId, 'fields', $ligne->bookingDate->toDateString(), $ligne->valueDate?->toDateString() ?? '', $ligne->direction->value,
                    (string) $ligne->amount, Text::fold($ligne->label), $ligne->endToEndId ?? '',
                );
            $vus[$cle] = ($vus[$cle] ?? 0) + 1;
            $resultat[] = ['key' => $cle, 'rank' => $vus[$cle]];
        }

        return $resultat;
    }

    /**
     * Lignes déjà connues par clé : nombre de lignes vivantes et plus grand rang, imports annulés compris (la numérotation continue).
     *
     * @param  list<string>  $cles
     * @return array<string, array{active: int, max: int}>
     */
    public function known(string $accountId, array $cles): array
    {
        $connus = [];

        foreach (array_chunk(array_values(array_unique($cles)), 500) as $paquet) {
            $lignes = DB::table('bank_statement_lines as l')
                ->join('bank_statements as s', function ($join): void {
                    $join->on('s.id', '=', 'l.statement_id')->on('s.organization_id', '=', 'l.organization_id');
                })
                ->where('l.organization_id', $this->organisation->id())
                ->where('l.bank_account_id', $accountId)->whereIn('l.dedup_key', $paquet)
                ->groupBy('l.dedup_key')
                ->selectRaw('l.dedup_key as k, MAX(l.occurrence) as m, SUM(CASE WHEN s.voided_at IS NULL THEN 1 ELSE 0 END) as a')
                ->get();

            foreach ($lignes as $ligne) {
                $connus[(string) $ligne->k] = ['active' => (int) $ligne->a, 'max' => (int) $ligne->m];
            }
        }

        return $connus;
    }

    /**
     * Rang à stocker pour chaque ligne à importer, null pour un doublon.
     *
     * @param  list<array{key: string, rank: int}>  $cles
     * @param  array<string, array{active: int, max: int}>  $connus
     * @return list<int|null>
     */
    public function occurrences(array $cles, array $connus): array
    {
        return array_map(static function (array $c) use ($connus): ?int {
            $connu = $connus[$c['key']] ?? ['active' => 0, 'max' => 0];

            return $c['rank'] > $connu['active'] ? $connu['max'] + ($c['rank'] - $connu['active']) : null;
        }, $cles);
    }
}
