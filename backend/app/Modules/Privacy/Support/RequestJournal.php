<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Support;

use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Models\PrivacyRequestEvent;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\Eloquent\Model;

/**
 * Journal de preuve et journal d'activité d'une demande : mêmes faits, jamais d'adresse, de nom ni de texte libre.
 */
final readonly class RequestJournal
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * @param  array<string, scalar|null>  $metadata
     */
    public function record(PrivacyRequest $demande, EventKind $evenement, ?string $acteur, array $metadata = [], ?string $auditAction = null, ?Model $sujetAudit = null): void
    {
        PrivacyRequestEvent::query()->create([
            'privacy_request_id' => $demande->id,
            'kind' => $evenement,
            'actor_user_id' => $acteur,
            'metadata' => $metadata,
            'occurred_at' => now(),
        ]);

        if ($auditAction !== null) {
            $this->audit->handle($auditAction, $acteur, ['request_id' => $demande->id, 'kind' => $demande->kind->value, ...$metadata], $sujetAudit ?? $demande);
        }
    }
}
