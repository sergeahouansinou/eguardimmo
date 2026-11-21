<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Resources;

use App\Modules\Privacy\Models\PrivacyRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ce que le demandeur lit de sa demande : état, échéance et disponibilité de l'export ; ni chemin de fichier ni nom d'opérateur.
 *
 * @mixin PrivacyRequest
 */
final class PrivacyRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $exportDisponible = $this->export_path !== null && $this->export_expires_at !== null && $this->export_expires_at->isFuture();

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'channel' => $this->channel->value,
            'status' => $this->status->value,
            'received_at' => $this->received_at->toIso8601String(),
            'due_at' => $this->due_at->toIso8601String(),
            'extended_until' => $this->extended_until?->toIso8601String(),
            'deadline' => $this->effectiveDueAt()->toIso8601String(),
            'refusal_reason' => $this->refusal_reason?->value,
            'completed_at' => $this->completed_at?->toIso8601String(),
            'export' => $this->export_generated_at === null ? null : [
                'available' => $exportDisponible,
                'expires_at' => $this->export_expires_at?->toIso8601String(),
                'downloaded_at' => $this->export_downloaded_at?->toIso8601String(),
            ],
        ];
    }
}
