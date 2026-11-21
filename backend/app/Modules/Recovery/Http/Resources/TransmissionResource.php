<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Resources;

use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Models\RecoveryTransmissionDownload;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * Jamais le jeton ni son empreinte : le jeton n'existe que dans l'e-mail.
 *
 * @property RecoveryTransmission $resource
 */
final class TransmissionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $t = $this->resource;

        return [
            'id' => $t->id,
            'bundle_id' => $t->bundle_id,
            'recipient' => ['party_id' => $t->recipient_party_id, 'email' => $t->recipient_email],
            'state' => $this->state($t),
            'expires_at' => $t->expires_at->toIso8601String(),
            'revoked_at' => $t->revoked_at?->toIso8601String(),
            'sent_at' => $t->sent_at?->toIso8601String(),
            'first_downloaded_at' => $t->first_downloaded_at?->toIso8601String(),
            'download_count' => $t->download_count,
            'replaces_id' => $t->replaces_id,
            'created_at' => $t->created_at->toIso8601String(),
            'downloads' => $this->whenLoaded('downloads', fn (): array => $t->downloads->map(fn (RecoveryTransmissionDownload $d): array => [
                'ip' => $d->ip,
                'downloaded_at' => $d->downloaded_at->toIso8601String(),
            ])->all()),
        ];
    }

    private function state(RecoveryTransmission $t): string
    {
        return match (true) {
            $t->revoked_at !== null => 'revoked',
            $t->expires_at->lessThanOrEqualTo(Carbon::now()) => 'expired',
            default => 'active',
        };
    }
}
