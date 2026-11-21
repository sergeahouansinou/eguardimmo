<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Queries;

use App\Modules\Identity\PublicApi\AccountContacts;
use App\Modules\Privacy\Data\ConsolePrivacyRequestData;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Models\PrivacyRequestEvent;

/**
 * Ce que la console lit d'une demande : coordonnées du demandeur, échéances, état et nombres ; jamais le contenu d'un export ni celui des organisations.
 */
final readonly class ConsoleRequestViews
{
    public function __construct(private AccountContacts $comptes, private RequestForwards $transmissions) {}

    /**
     * @param  iterable<PrivacyRequest>  $demandes
     * @return list<ConsolePrivacyRequestData>
     */
    public function of(iterable $demandes, bool $avecEvenements = false): array
    {
        $liste = [...$demandes];
        $contacts = $this->comptes->contacts(array_values(array_filter(array_map(fn (PrivacyRequest $d): ?string => $d->requester_user_id, $liste))));
        $transmissions = $this->transmissions->countsOf(array_values(array_map(fn (PrivacyRequest $d): string => $d->id, $liste)));

        return array_values(array_map(function (PrivacyRequest $d) use ($contacts, $transmissions, $avecEvenements): ConsolePrivacyRequestData {
            $contact = $d->requester_user_id === null ? null : ($contacts[$d->requester_user_id] ?? null);

            return new ConsolePrivacyRequestData(
                id: $d->id,
                kind: $d->kind->value,
                channel: $d->channel->value,
                status: $d->status->value,
                receivedAt: $d->received_at,
                dueAt: $d->due_at,
                extendedUntil: $d->extended_until,
                extensionReason: $d->extension_reason?->value,
                deadline: $d->effectiveDueAt(),
                overdue: $d->isOverdue(),
                identityVerifiedBy: $d->identity_verified_by?->value,
                identityVerifiedAt: $d->identity_verified_at,
                accountId: $d->requester_user_id,
                requesterName: $contact?->name,
                requesterEmail: $contact->email ?? $d->requester_email,
                forwardedCount: $transmissions[$d->id]['total'] ?? 0,
                forwardsHandled: $transmissions[$d->id]['handled'] ?? 0,
                refusalReason: $d->refusal_reason?->value,
                completedAt: $d->completed_at,
                exportGenerated: $d->export_generated_at !== null,
                exportExpiresAt: $d->export_expires_at,
                exportDownloaded: $d->export_downloaded_at !== null,
                events: $avecEvenements ? array_values($d->events->map(fn (PrivacyRequestEvent $e): array => [
                    'kind' => $e->kind->value,
                    'occurred_at' => $e->occurred_at->toIso8601String(),
                    'actor_id' => $e->actor_user_id,
                ])->all()) : null,
            );
        }, $liste));
    }

    public function one(PrivacyRequest $demande, bool $avecEvenements = false): ConsolePrivacyRequestData
    {
        if ($avecEvenements) {
            $demande->load('events');
        }

        return $this->of([$demande], $avecEvenements)[0];
    }
}
