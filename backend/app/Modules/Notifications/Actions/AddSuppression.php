<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\SuppressionReason;
use App\Modules\Notifications\Models\MailSuppression;
use Illuminate\Database\UniqueConstraintViolationException;

final readonly class AddSuppression
{
    /**
     * Idempotent : une adresse déjà supprimée dans ce périmètre garde sa première raison.
     *
     * @param  string|null  $organizationId  null : toute la plateforme (rebond définitif, plainte)
     */
    public function handle(?string $organizationId, string $emailHash, SuppressionReason $raison): void
    {
        try {
            MailSuppression::query()->firstOrCreate(
                ['scope_key' => $organizationId ?? MailSuppression::PLATEFORME, 'email_hash' => $emailHash],
                ['organization_id' => $organizationId, 'reason' => $raison],
            );
        } catch (UniqueConstraintViolationException) {
            return;
        }
    }
}
