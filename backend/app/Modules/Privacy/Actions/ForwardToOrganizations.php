<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\AccountContacts;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Events\PrivacyRequestForwarded;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Models\PrivacyRequestForward;
use App\Modules\Privacy\Queries\PrivacyRequests;
use App\Modules\Privacy\Queries\RequestForwards;
use App\Modules\Privacy\Support\LinkedOrganizations;
use App\Modules\Privacy\Support\RequestJournal;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class ForwardToOrganizations
{
    public function __construct(
        private PrivacyRequests $demandes,
        private RequestForwards $transmissions,
        private LinkedOrganizations $organisations,
        private AccountContacts $comptes,
        private CurrentOrganization $contexte,
        private RequestJournal $journal,
    ) {}

    /**
     * Transmet la demande à chaque organisation liée au compte qui ne l'a pas encore reçue ; une seconde exécution ne transmet que les nouvelles.
     *
     * @return array{request: PrivacyRequest, forwarded: int}
     */
    public function handle(string $id, User $operateur): array
    {
        return DB::transaction(function () use ($id, $operateur): array {
            $demande = $this->demandes->forUpdate($id);

            if (! $demande->status->isOpen()) {
                throw ErrorCode::RequestClosed->problem();
            }

            if (! $demande->isIdentityVerified()) {
                throw ErrorCode::IdentityNotVerified->problem();
            }

            $contact = $demande->requester_user_id === null ? null : ($this->comptes->contacts([$demande->requester_user_id])[$demande->requester_user_id] ?? null);

            if ($contact === null) {
                throw ErrorCode::AccountRequired->problem();
            }

            $dejaTransmises = $this->transmissions->organizationIdsOf($demande->id);
            $nouvelles = array_values(array_diff($this->organisations->of($contact->id), $dejaTransmises));

            foreach ($nouvelles as $organisationId) {
                $transmission = $this->contexte->run($organisationId, fn (): PrivacyRequestForward => PrivacyRequestForward::query()->create([
                    'privacy_request_id' => $demande->id,
                    'requester_name' => $contact->name,
                    'requester_email' => $contact->email,
                    'forwarded_at' => now(),
                ]));

                PrivacyRequestForwarded::dispatch($demande->id, $organisationId, $transmission->id);
            }

            $demande->forceFill([
                'forwarded_count' => count($dejaTransmises) + count($nouvelles),
                'handled_by_user_id' => $operateur->id,
                'status' => RequestStatus::InProgress,
            ])->save();

            $this->journal->record($demande, EventKind::Forwarded, $operateur->id, ['organizations' => count($nouvelles)], 'privacy.request.forwarded');

            return ['request' => $demande, 'forwarded' => count($nouvelles)];
        });
    }
}
