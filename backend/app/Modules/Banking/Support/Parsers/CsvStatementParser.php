<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support\Parsers;

use App\Modules\Banking\Data\ParsedLine;
use App\Modules\Banking\Data\ParsedStatement;
use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\StatementSource;
use App\Modules\Banking\Support\AmountParser;
use App\Modules\Banking\Support\Text;
use Carbon\CarbonImmutable;
use DateTimeImmutable;

/**
 * CSV décrit par le profil du compte : séparateur, colonnes, format de date et de montant. Une ligne invalide est
 * refusée avec son numéro et un code, jamais son contenu.
 */
final readonly class CsvStatementParser
{
    public const DELIMITERS = [';', ',', "\t"];

    public const DATE_FORMATS = ['d/m/Y', 'Y-m-d', 'd-m-Y', 'd.m.Y'];

    public const COLUMNS = ['booking_date', 'value_date', 'label', 'amount', 'credit', 'debit', 'bank_reference', 'end_to_end_id', 'remittance_reference', 'counterparty_name', 'counterparty_iban', 'transaction_code'];

    /**
     * @param  array<string, mixed>  $profil
     */
    public function parse(string $contenu, array $profil, string $currency, int $maxLines): ParsedStatement
    {
        $delimiteur = $profil['delimiter'] ?? ';';
        $format = $profil['date_format'] ?? 'd/m/Y';
        $decimal = $profil['decimal_separator'] ?? ',';
        $milliers = $profil['thousands_separator'] ?? null;
        $colonnes = $profil['columns'] ?? null;

        if (! is_string($delimiteur) || ! in_array($delimiteur, self::DELIMITERS, true) || ! is_string($format) || ! in_array($format, self::DATE_FORMATS, true)
            || ! is_string($decimal) || ! in_array($decimal, [',', '.'], true) || ! is_array($colonnes) || ! is_string($milliers ?? '')) {
            throw ErrorCode::StatementInvalid->problem('Le profil CSV du compte est incomplet.');
        }

        $flux = fopen('php://temp', 'r+');

        if ($flux === false) {
            throw ErrorCode::StatementInvalid->problem();
        }

        fwrite($flux, $contenu);
        rewind($flux);

        $enTete = ($profil['has_header'] ?? true) === true;
        $index = null;
        $numero = 0;
        $lignes = [];
        $refus = [];
        $total = 0;

        while (($champs = fgetcsv($flux, 4096, $delimiteur, '"', '')) !== false) {
            $numero++;

            if ($champs === [null]) {
                continue;
            }

            if ($enTete && $index === null) {
                $index = $this->headerIndex($champs);

                continue;
            }

            if (++$total > $maxLines) {
                fclose($flux);
                throw ErrorCode::StatementTooLarge->problem();
            }

            $resultat = $this->line($numero, $champs, $colonnes, $index, $format, $decimal, $milliers, $currency);

            if (is_string($resultat)) {
                $refus[] = ['line' => $numero, 'code' => $resultat];
            } else {
                $lignes[] = $resultat;
            }
        }

        fclose($flux);

        if ($lignes === []) {
            throw ErrorCode::StatementInvalid->problem($refus === [] ? 'Le fichier ne contient aucune ligne.' : 'Aucune ligne valide dans le fichier.');
        }

        $dates = array_map(static fn (ParsedLine $l): int => $l->bookingDate->getTimestamp(), $lignes);

        return new ParsedStatement(
            StatementSource::Csv, null, null, null,
            CarbonImmutable::createFromTimestampUTC((int) min($dates))->startOfDay(),
            CarbonImmutable::createFromTimestampUTC((int) max($dates))->startOfDay(),
            null, null, $currency, false, null, $lignes, $refus,
        );
    }

    /**
     * @param  list<string|null>  $champs
     * @return array<string, int>
     */
    private function headerIndex(array $champs): array
    {
        $index = [];

        foreach ($champs as $position => $nom) {
            $index[Text::fold((string) $nom)] = $position;
        }

        return $index;
    }

    /**
     * @param  list<string|null>  $champs
     * @param  array<array-key, mixed>  $colonnes
     * @param  array<string, int>|null  $index
     */
    private function line(int $numero, array $champs, array $colonnes, ?array $index, string $format, string $decimal, ?string $milliers, string $currency): ParsedLine|string
    {
        $lire = function (string $colonne) use ($champs, $colonnes, $index): ?string {
            $ref = $colonnes[$colonne] ?? null;

            if (is_int($ref) && $ref >= 1) {
                $position = $ref - 1;
            } elseif (is_string($ref) && $index !== null) {
                $position = $index[Text::fold($ref)] ?? null;
            } else {
                return null;
            }

            $valeur = $position === null ? null : ($champs[$position] ?? null);

            return $valeur === null || trim($valeur) === '' ? null : trim($valeur);
        };

        $date = $this->date($lire('booking_date'), $format);

        if ($date === null) {
            return 'date_invalid';
        }

        $valeurDate = $lire('value_date') === null ? null : $this->date($lire('value_date'), $format);

        if ($lire('value_date') !== null && $valeurDate === null) {
            return 'date_invalid';
        }

        $signe = $lire('amount');

        if ($signe !== null) {
            $montant = AmountParser::minorUnits($signe, $currency, $decimal, $milliers);
        } else {
            $credit = $lire('credit');
            $debit = $lire('debit');
            $c = $credit === null ? 0 : AmountParser::minorUnits($credit, $currency, $decimal, $milliers);
            $d = $debit === null ? 0 : AmountParser::minorUnits($debit, $currency, $decimal, $milliers);

            if ($c === null || $d === null || ($c !== 0 && $d !== 0)) {
                return 'amount_invalid';
            }

            $montant = $c !== 0 ? $c : -abs($d);
        }

        if ($montant === null) {
            return 'amount_invalid';
        }

        if ($montant === 0) {
            return 'amount_zero';
        }

        $libelle = Text::clean($lire('label'), 500);

        if ($libelle === null) {
            return 'label_missing';
        }

        return new ParsedLine(
            $numero, $date, $valeurDate,
            $montant > 0 ? Direction::Credit : Direction::Debit, abs($montant), $currency,
            null, null, false,
            Text::clean($lire('bank_reference'), 64), Text::clean($lire('end_to_end_id'), 64), Text::clean($lire('transaction_code'), 40),
            $libelle, Text::clean($lire('remittance_reference'), 140),
            Text::clean($lire('counterparty_name'), 140), $lire('counterparty_iban'),
        );
    }

    private function date(?string $valeur, string $format): ?CarbonImmutable
    {
        if ($valeur === null) {
            return null;
        }

        $date = DateTimeImmutable::createFromFormat('!'.$format, $valeur);
        $erreurs = DateTimeImmutable::getLastErrors();

        if ($date === false || ($erreurs !== false && ($erreurs['warning_count'] + $erreurs['error_count']) > 0)) {
            return null;
        }

        return CarbonImmutable::instance($date);
    }
}
