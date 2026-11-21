<?php

declare(strict_types=1);

namespace App\Modules\Investments\Support;

use App\Modules\Investments\Data\ScheduleRowData;
use App\Modules\Investments\Enums\ErrorCode;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;

/**
 * Tableau d'amortissement de la banque (CSV `date;mensualité;intérêts;capital;assurance;restant dû`) : relu et revérifié par le serveur,
 * jamais pris tel quel. Les montants se lisent en chaînes décimales, sans flottant.
 */
final class ScheduleImport
{
    private const int FICHIER_MAX_OCTETS = 262144;

    /**
     * @return list<ScheduleRowData>
     */
    public function parse(UploadedFile $fichier, int $decimals, int $principal): array
    {
        $contenu = $fichier->getSize() !== false && $fichier->getSize() <= self::FICHIER_MAX_OCTETS ? file_get_contents($fichier->getRealPath() ?: '') : false;

        if (! is_string($contenu) || ! mb_check_encoding($contenu, 'UTF-8')) {
            throw ErrorCode::FileInvalid->problem('Le fichier doit être un CSV UTF-8 de 256 Ko au plus.');
        }

        $lignes = array_values(array_filter(preg_split('/\r\n|\n|\r/', ltrim($contenu, "\xEF\xBB\xBF")) ?: [], fn (string $l): bool => trim($l) !== ''));
        $max = (int) config('investments.import_max_lines');

        if ($lignes !== [] && preg_match('/^\d/', $lignes[0]) !== 1) {
            array_shift($lignes);
        }

        if ($lignes === [] || count($lignes) > $max) {
            throw ErrorCode::LoanScheduleInconsistent->problem("Le tableau doit comporter de 1 à {$max} lignes.");
        }

        $rows = [];

        foreach ($lignes as $numero => $ligne) {
            $c = array_map('trim', explode(';', $ligne));

            if (count($c) !== 6) {
                throw ErrorCode::LoanScheduleInconsistent->problem('Ligne '.($numero + 1).' : six colonnes attendues.');
            }

            $rows[] = new ScheduleRowData(
                $this->date($c[0], $numero + 1),
                $this->amount($c[1], $decimals, $numero + 1),
                $this->amount($c[2], $decimals, $numero + 1),
                $this->amount($c[3], $decimals, $numero + 1),
                $this->amount($c[4], $decimals, $numero + 1),
                $this->amount($c[5], $decimals, $numero + 1),
            );
        }

        $this->verify($rows, $principal);

        return $rows;
    }

    /**
     * @param  list<ScheduleRowData>  $rows
     */
    public function verify(array $rows, int $principal): void
    {
        $restant = $principal;
        $somme = 0;
        $precedent = null;

        foreach ($rows as $i => $r) {
            $mois = (int) substr($r->dueOn, 0, 4) * 12 + (int) substr($r->dueOn, 5, 2);

            if ($precedent !== null && $mois !== $precedent + 1) {
                throw ErrorCode::LoanScheduleInconsistent->problem('Ligne '.($i + 1).' : les dates doivent être mensuelles et croissantes.');
            }

            if ($r->payment !== $r->interest + $r->principal) {
                throw ErrorCode::LoanScheduleInconsistent->problem('Ligne '.($i + 1).' : la mensualité doit égaler intérêts + capital.');
            }

            if ($r->outstandingAfter !== $restant - $r->principal || $r->principal > $restant) {
                throw ErrorCode::LoanScheduleInconsistent->problem('Ligne '.($i + 1).' : le restant dû ne suit pas le capital amorti.');
            }

            $restant = $r->outstandingAfter;
            $somme += $r->principal;
            $precedent = $mois;
        }

        if ($somme !== $principal || $restant !== 0) {
            throw ErrorCode::LoanScheduleInconsistent->problem('La somme du capital amorti doit égaler le capital emprunté et le restant dû finir à zéro.');
        }
    }

    private function date(string $valeur, int $ligne): string
    {
        $date = preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', $valeur, $m) === 1 ? "{$m[3]}-{$m[2]}-{$m[1]}" : $valeur;

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) !== 1 || CarbonImmutable::createFromFormat('!Y-m-d', $date)?->toDateString() !== $date) {
            throw ErrorCode::LoanScheduleInconsistent->problem("Ligne {$ligne} : date invalide.");
        }

        return $date;
    }

    private function amount(string $valeur, int $decimals, int $ligne): int
    {
        $propre = str_replace([' ', "\u{00A0}"], '', $valeur);
        $motif = $decimals === 0 ? '/^\d{1,13}$/' : '/^\d{1,13}(?:[.,]\d{1,'.$decimals.'})?$/';

        if (preg_match($motif, $propre) !== 1) {
            throw ErrorCode::LoanScheduleInconsistent->problem("Ligne {$ligne} : montant invalide.");
        }

        [$entier, $fraction] = array_pad(explode('.', str_replace(',', '.', $propre)), 2, '');

        return (int) ($entier.str_pad($fraction, $decimals, '0'));
    }
}
