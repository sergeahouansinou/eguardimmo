<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Shared\Http\ApiProblem;
use DateTimeImmutable;
use InvalidArgumentException;
use Money\Currencies\ISOCurrencies;
use Money\Currency;

final readonly class CustomFieldValue
{
    private const TEXTE_MAX = 2000;

    private const URL_MAX = 2048;

    public function __construct(private TermDirectory $termes) {}

    /**
     * @param  bool  $inchangee  la valeur est déjà enregistrée : une valeur de référentiel archivée depuis reste acceptée
     *
     * @throws InvalidArgumentException message affichable à l'utilisateur
     */
    public function normalize(CustomFieldDefinition $champ, mixed $valeur, bool $inchangee): mixed
    {
        return match ($champ->type) {
            CustomFieldType::Text => $this->texte($valeur),
            CustomFieldType::Number => is_int($valeur) || (is_float($valeur) && is_finite($valeur)) ? $valeur : throw new InvalidArgumentException('Un nombre est attendu.'),
            CustomFieldType::Money => $this->montant($valeur),
            CustomFieldType::Date => $this->date($valeur),
            CustomFieldType::Bool => is_bool($valeur) ? $valeur : throw new InvalidArgumentException('Un booléen est attendu.'),
            CustomFieldType::Select => $this->choix($champ, $valeur),
            CustomFieldType::Multiselect => $this->choixMultiple($champ, $valeur),
            CustomFieldType::Term => $this->terme($champ, $valeur, $inchangee),
            CustomFieldType::Url => $this->url($valeur),
        };
    }

    private function texte(mixed $valeur): string
    {
        if (! is_string($valeur) || mb_strlen($valeur) > self::TEXTE_MAX) {
            throw new InvalidArgumentException('Un texte de '.self::TEXTE_MAX.' caractères au plus est attendu.');
        }

        return $valeur;
    }

    /**
     * @return array{amount: int, currency: string}
     */
    private function montant(mixed $valeur): array
    {
        $refus = new InvalidArgumentException('Un montant {amount, currency} est attendu : entier en unités mineures et devise ISO 4217.');

        if (! is_array($valeur) || array_diff(array_keys($valeur), ['amount', 'currency']) !== [] || ! is_int($valeur['amount'] ?? null)) {
            throw $refus;
        }

        $devise = $valeur['currency'] ?? null;

        if (! is_string($devise) || preg_match('/^[A-Z]{3}$/D', $devise) !== 1 || ! (new ISOCurrencies)->contains(new Currency($devise))) {
            throw $refus;
        }

        return ['amount' => $valeur['amount'], 'currency' => $devise];
    }

    private function date(mixed $valeur): string
    {
        $date = is_string($valeur) ? DateTimeImmutable::createFromFormat('!Y-m-d', $valeur) : false;

        if ($date === false || $date->format('Y-m-d') !== $valeur) {
            throw new InvalidArgumentException('Une date au format AAAA-MM-JJ est attendue.');
        }

        return $date->format('Y-m-d');
    }

    private function choix(CustomFieldDefinition $champ, mixed $valeur): string
    {
        if (! is_string($valeur) || ! in_array($valeur, $champ->optionKeys(), true)) {
            throw new InvalidArgumentException('Cette valeur ne fait pas partie des options du champ.');
        }

        return $valeur;
    }

    /**
     * @return list<string>
     */
    private function choixMultiple(CustomFieldDefinition $champ, mixed $valeur): array
    {
        if (! is_array($valeur) || ! array_is_list($valeur) || count($valeur) !== count(array_unique($valeur))) {
            throw new InvalidArgumentException('Une liste d\'options sans doublon est attendue.');
        }

        return array_map(fn (mixed $v): string => $this->choix($champ, $v), $valeur);
    }

    private function terme(CustomFieldDefinition $champ, mixed $valeur, bool $inchangee): string
    {
        $vocabulaire = VocabularyKey::tryFrom((string) $champ->vocabulary);

        if (! is_string($valeur) || $vocabulaire === null) {
            throw new InvalidArgumentException('Un identifiant de valeur de référentiel est attendu.');
        }

        try {
            $inchangee ? $this->termes->find($valeur, $vocabulaire) : $this->termes->findAssignable($valeur, $vocabulaire);
        } catch (ApiProblem $probleme) {
            if ($probleme->problemCode !== ErrorCode::TermNotFound->value) {
                throw $probleme;
            }

            throw new InvalidArgumentException('Cette valeur n\'existe pas dans le référentiel ou n\'est plus disponible.');
        }

        return $valeur;
    }

    private function url(mixed $valeur): string
    {
        $partie = is_string($valeur) && mb_strlen($valeur) <= self::URL_MAX ? parse_url($valeur) : false;

        if (! is_string($valeur) || $partie === false || ! in_array($partie['scheme'] ?? null, ['http', 'https'], true) || ! isset($partie['host']) || filter_var($valeur, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException('Une adresse http ou https valide est attendue.');
        }

        return $valeur;
    }
}
