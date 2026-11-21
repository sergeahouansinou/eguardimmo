<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Enums\ContactUpdateStatus;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Events\ContactUpdateRequested;
use App\Modules\Parties\Models\ContactUpdateRequest;
use App\Modules\Parties\PublicApi\PartyLinks;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class RequestContactUpdate
{
    public function __construct(
        private PartyLinks $liens,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Les valeurs viennent du compte, jamais du client ; seuls les champs à transmettre sont choisis. Rejouable par `client_id`.
     * Une nouvelle demande écarte la précédente encore en attente de la même fiche.
     *
     * @param  list<string>  $fields  `email`, `phone`
     * @return array{request: ContactUpdateRequest, replayed: bool}
     */
    public function handle(User $user, string $organizationId, array $fields, string $clientId): array
    {
        $lien = collect($this->liens->linkedTo($user->id))->first(fn ($l): bool => $l->organizationId === $organizationId)
            ?? throw ErrorCode::ContactUpdateNotFound->problem();

        $email = in_array('email', $fields, true) ? mb_strtolower($user->email) : null;
        $phone = in_array('phone', $fields, true) ? $user->phone : null;

        if ($email === null && $phone === null) {
            throw ErrorCode::ContactUpdateEmpty->problem();
        }

        return $this->contexte->run($organizationId, function () use ($user, $lien, $email, $phone, $clientId, $organizationId): array {
            $existante = ContactUpdateRequest::query()->where('party_id', $lien->partyId)->where('client_id', $clientId)->first();

            if ($existante !== null) {
                return $this->rejouer($existante, $email, $phone);
            }

            try {
                $demande = DB::transaction(function () use ($user, $lien, $email, $phone, $clientId): ContactUpdateRequest {
                    ContactUpdateRequest::query()->where('party_id', $lien->partyId)->where('status', ContactUpdateStatus::Pending->value)
                        ->update(['status' => ContactUpdateStatus::Dismissed->value, 'email' => null, 'phone' => null, 'decided_at' => now()]);

                    $demande = ContactUpdateRequest::query()->create([
                        'party_id' => $lien->partyId,
                        'requested_by_user_id' => $user->id,
                        'client_id' => $clientId,
                        'email' => $email,
                        'phone' => $phone,
                        'status' => ContactUpdateStatus::Pending,
                    ]);
                    $this->audit->handle('parties.contact_update.requested', $user->id, ['fields' => array_values(array_filter([$email !== null ? 'email' : null, $phone !== null ? 'phone' : null]))], $demande);

                    return $demande;
                });
            } catch (UniqueConstraintViolationException $erreur) {
                $existante = ContactUpdateRequest::query()->where('party_id', $lien->partyId)->where('client_id', $clientId)->first() ?? throw $erreur;

                return $this->rejouer($existante, $email, $phone);
            }

            ContactUpdateRequested::dispatch($demande->id, $lien->partyId, $organizationId);

            return ['request' => $demande, 'replayed' => false];
        });
    }

    /**
     * @return array{request: ContactUpdateRequest, replayed: bool}
     */
    private function rejouer(ContactUpdateRequest $existante, ?string $email, ?string $phone): array
    {
        $memes = $existante->status !== ContactUpdateStatus::Pending || ($existante->email === $email && $existante->phone === $phone);

        if (! $memes) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return ['request' => $existante, 'replayed' => true];
    }
}
