<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Parties\Data\PartyInvoiceData;
use App\Modules\Parties\Enums\IdentifierScheme;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\PartyIdentifier;

final readonly class PartyInvoiceIdentities
{
    public function __construct(private Parties $parties) {}

    /**
     * Lève party_not_found hors de l'organisation courante. Une partie anonymisée n'expose ni adresse ni identifiant.
     */
    public function one(string $id): PartyInvoiceData
    {
        $partie = $this->parties->get($id);

        if ($partie->isAnonymized()) {
            return new PartyInvoiceData($partie->id, $partie->display_name, $partie->kind, null, null, null, null, null, true);
        }

        $identifiants = [];

        foreach (PartyIdentifier::query()->where('party_id', $partie->id)->whereIn('scheme', [IdentifierScheme::Siren->value, IdentifierScheme::Siret->value, IdentifierScheme::Vat->value])->orderBy('id')->get() as $ligne) {
            $identifiants[$ligne->scheme->value] ??= $ligne->value;
        }

        $courriel = ContactPoint::query()->where('party_id', $partie->id)->where('type', 'email')->where('is_primary', true)->value('value');

        return new PartyInvoiceData(
            id: $partie->id,
            displayName: $partie->display_name,
            kind: $partie->kind,
            address: $partie->address,
            siren: $identifiants[IdentifierScheme::Siren->value] ?? null,
            siret: $identifiants[IdentifierScheme::Siret->value] ?? null,
            vatNumber: $identifiants[IdentifierScheme::Vat->value] ?? null,
            primaryEmail: is_string($courriel) ? $courriel : null,
            isAnonymized: false,
        );
    }
}
