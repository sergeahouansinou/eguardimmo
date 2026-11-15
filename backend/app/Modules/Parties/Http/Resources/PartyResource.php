<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Catalog\Data\TagData;
use App\Modules\Catalog\Data\TermData;
use App\Modules\Parties\Support\PartyDetail;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PartyDetail $resource
 */
final class PartyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $partie = $this->resource->party;

        return [
            'id' => $partie->id,
            'kind' => $partie->kind->value,
            'display_name' => $partie->display_name,
            'last_name' => $partie->last_name,
            'first_name' => $partie->first_name,
            'company_name' => $partie->company_name,
            'legal_form_term_id' => $partie->legal_form_term_id,
            'birth_date' => $partie->birth_date?->toDateString(),
            'address' => $partie->address,
            'language' => $partie->language,
            'has_account' => $partie->user_id !== null,
            'custom_fields' => (object) $partie->custom_fields,
            'lock_version' => $partie->lock_version,
            'is_anonymized' => $partie->isAnonymized(),
            'anonymized_at' => $partie->anonymized_at?->toIso8601String(),
            'archived_at' => $partie->archived_at?->toIso8601String(),
            'categories' => array_map(fn (TermData $terme): array => [
                'id' => $terme->id,
                'key' => $terme->key,
                'label' => $terme->label(),
                'semantic_key' => $terme->semanticKey,
            ], $this->resource->categories),
            'tags' => array_map(fn (TagData $etiquette): array => [
                'id' => $etiquette->id,
                'name' => $etiquette->name,
                'slug' => $etiquette->slug,
                'color' => $etiquette->color,
            ], $this->resource->tags),
            'contact_points' => ContactPointResource::collection($partie->contactPoints)->resolve($request),
            'identifiers' => IdentifierResource::collection($partie->identifiers)->resolve($request),
            'bank_accounts' => BankAccountResource::collection($partie->bankAccounts)->resolve($request),
        ];
    }
}
