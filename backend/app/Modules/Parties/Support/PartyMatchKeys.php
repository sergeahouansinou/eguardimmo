<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use App\Modules\Parties\Data\NewIdentifierData;
use App\Modules\Parties\Data\NewPartyData;
use App\Modules\Parties\Enums\ContactPointType;
use App\Modules\Parties\Enums\IdentifierScheme;
use App\Modules\Parties\Enums\PartyKind;

/**
 * Clés de rapprochement d'une fiche à créer : valeurs déjà normalisées, comparables à celles des fiches existantes.
 */
final readonly class PartyMatchKeys
{
    /**
     * @param  list<string>  $emails
     * @param  list<string>  $phones  toutes formes admises
     * @param  list<string>  $identifierHashes
     */
    public function __construct(
        public PartyKind $kind,
        public string $displayName,
        public array $emails,
        public array $phones,
        public array $identifierHashes,
    ) {}

    public static function of(NewPartyData $donnees, Fingerprinter $empreintes, string $pays): self
    {
        $emails = [];
        $telephones = [];

        foreach ($donnees->contactPoints as $point) {
            $valeur = ContactPointValue::normalize($point->type, $point->value);

            if ($point->type === ContactPointType::Email) {
                $emails[] = $valeur;
            } else {
                $telephones = [...$telephones, ...PhoneVariants::of($valeur, $pays)];
            }
        }

        $hashes = array_map(
            fn (NewIdentifierData $i): string => $empreintes->identifier($i->scheme, $i->country, IdentifierScheme::normalize($i->value)),
            $donnees->identifiers,
        );

        $nom = PartyShape::displayName($donnees->kind, [
            'last_name' => $donnees->lastName, 'first_name' => $donnees->firstName, 'company_name' => $donnees->companyName,
        ]);

        return new self($donnees->kind, $nom, array_values(array_unique($emails)), array_values(array_unique($telephones)), $hashes);
    }

    /**
     * Clés textuelles pour repérer deux lignes d'un même fichier qui parlent de la même fiche.
     *
     * @return list<string>
     */
    public function signatures(): array
    {
        $nom = mb_strtolower((string) preg_replace('/\s+/', ' ', trim($this->displayName)));

        return [
            ...array_map(fn (string $e): string => 'email:'.$e, $this->emails),
            ...array_map(fn (string $t): string => 'phone:'.$t, $this->phones),
            ...array_map(fn (string $h): string => 'identifier:'.$h, $this->identifierHashes),
            ...($nom === '' ? [] : ['name:'.$this->kind->value.':'.$nom]),
        ];
    }
}
