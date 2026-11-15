<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Resources;

use App\Modules\Documents\Enums\CertificateState;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Documents\Support\CertificateTypes;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Certificate $resource
 */
final class CertificateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $piece = $this->resource;
        $types = app(CertificateTypes::class);
        $type = $types->find($piece->certificate_type_term_id);

        return [
            'id' => $piece->id,
            'subject' => ['type' => $piece->subject_type, 'id' => $piece->subject_id],
            'type' => ['id' => $type->id, 'key' => $type->key, 'label' => $type->label(), 'semantic_key' => $type->semanticKey],
            'reference' => $piece->reference,
            'issuer_party_id' => $piece->issuer_party_id,
            'issued_on' => $piece->issued_on->toDateString(),
            'expires_on' => $piece->expires_on?->toDateString(),
            'state' => CertificateState::at(now(), $piece->expires_on, $types->reminderDays($type))->value,
            'values' => (object) $piece->data,
            'stored_file_id' => $piece->stored_file_id,
            'replaces_id' => $piece->replaces_id,
            'replaced_by_id' => $piece->replacement?->id,
        ];
    }
}
