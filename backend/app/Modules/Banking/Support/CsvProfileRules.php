<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Support\Parsers\CsvStatementParser;
use Closure;
use Illuminate\Validation\Rule;

/**
 * Règles du profil CSV d'un compte : liste blanche de séparateurs, de formats de date et de colonnes.
 */
final class CsvProfileRules
{
    /**
     * @return array<string, list<mixed>>
     */
    public static function for(string $champ = 'csv_profile'): array
    {
        $colonne = static function (string $attribut, mixed $valeur, Closure $echec): void {
            $valide = (is_int($valeur) && $valeur >= 1 && $valeur <= 200) || (is_string($valeur) && trim($valeur) !== '' && mb_strlen($valeur) <= 80);

            if (! $valide) {
                $echec('Colonne invalide.');
            }
        };
        $facultatives = [];

        foreach (['value_date', 'bank_reference', 'end_to_end_id', 'remittance_reference', 'counterparty_name', 'counterparty_iban', 'transaction_code'] as $nom) {
            $facultatives["{$champ}.columns.{$nom}"] = ['nullable', $colonne];
        }

        return [
            $champ => ['nullable', 'array:delimiter,encoding,has_header,date_format,decimal_separator,thousands_separator,columns'],
            "{$champ}.delimiter" => ["required_with:{$champ}", Rule::in(CsvStatementParser::DELIMITERS)],
            "{$champ}.encoding" => ['nullable', Rule::in(['UTF-8', 'Windows-1252'])],
            "{$champ}.has_header" => ['nullable', 'boolean'],
            "{$champ}.date_format" => ["required_with:{$champ}", Rule::in(CsvStatementParser::DATE_FORMATS)],
            "{$champ}.decimal_separator" => ["required_with:{$champ}", Rule::in([',', '.'])],
            "{$champ}.thousands_separator" => ['nullable', Rule::in([' ', '.', ',', ''])],
            "{$champ}.columns" => ["required_with:{$champ}", 'array:'.implode(',', CsvStatementParser::COLUMNS)],
            "{$champ}.columns.booking_date" => ["required_with:{$champ}", $colonne],
            "{$champ}.columns.label" => ["required_with:{$champ}", $colonne],
            "{$champ}.columns.amount" => ["exclude_without:{$champ}", "required_without_all:{$champ}.columns.credit,{$champ}.columns.debit", 'nullable', $colonne],
            "{$champ}.columns.credit" => ["required_with:{$champ}.columns.debit", 'nullable', $colonne],
            "{$champ}.columns.debit" => ["required_with:{$champ}.columns.credit", 'nullable', $colonne],
            ...$facultatives,
        ];
    }
}
