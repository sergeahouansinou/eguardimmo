<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use App\Modules\Messaging\Data\NewTicketData;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\RequesterSpace;
use App\Modules\Messaging\Enums\TicketPriority;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Support\ReferenceSequence;
use App\Modules\Messaging\Support\StartedTicket;
use App\Modules\Organizations\Data\MembershipData;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Le profil déclaré est vérifié par le serveur. Rejouable : un `client_id` déjà reçu rend la demande existante sans rien écrire ;
 * le même `client_id` avec un autre contenu est refusé.
 */
final readonly class OpenSupportTicket
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private ProfileRegistry $profils,
        private PostSupportMessage $poster,
    ) {}

    public function handle(User $demandeur, NewTicketData $donnees): StartedTicket
    {
        $adhesion = $this->controlerProfil($demandeur, $donnees);

        $existant = $this->rejeu($demandeur, $donnees, $adhesion);

        if ($existant !== null) {
            return new StartedTicket($existant, true);
        }

        try {
            $ticket = DB::transaction(function () use ($demandeur, $donnees, $adhesion): SupportTicket {
                $ticket = SupportTicket::query()->create([
                    'reference' => ReferenceSequence::next(),
                    'requester_user_id' => $demandeur->id,
                    'organization_id' => $adhesion?->organizationId,
                    'organization_name' => $adhesion?->organizationName,
                    'space' => $donnees->space,
                    'category' => $donnees->category,
                    'subject' => $donnees->subject,
                    'priority' => TicketPriority::Normal,
                    'status' => TicketStatus::Open,
                    'client_id' => $donnees->clientId,
                    'last_activity_at' => now(),
                ]);

                $this->poster->handle($ticket, $demandeur, fromSupport: false, internal: false, body: $donnees->body, attachments: $donnees->attachments);

                return $ticket;
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $existant = $this->rejeu($demandeur, $donnees, $adhesion) ?? throw $erreur;

            return new StartedTicket($existant, true);
        }

        return new StartedTicket($ticket, false);
    }

    private function controlerProfil(User $demandeur, NewTicketData $donnees): ?MembershipData
    {
        if ($donnees->space === RequesterSpace::Organization) {
            $adhesion = $donnees->organizationId === null ? null : $this->adhesions->activeMembership($demandeur->id, $donnees->organizationId);

            return $adhesion ?? throw ErrorCode::NotAMember->problem();
        }

        $autorise = match ($donnees->space) {
            RequesterSpace::Tenant => $this->profils->has($demandeur->id, Space::Tenant),
            RequesterSpace::Owner => $this->profils->has($demandeur->id, Space::Owner),
            default => $demandeur->email_verified_at !== null,
        };

        if (! $autorise) {
            throw ErrorCode::SupportSpaceForbidden->problem();
        }

        return null;
    }

    private function rejeu(User $demandeur, NewTicketData $donnees, ?MembershipData $adhesion): ?SupportTicket
    {
        if ($donnees->clientId === null) {
            return null;
        }

        $ticket = SupportTicket::query()
            ->where('requester_user_id', $demandeur->id)
            ->where('client_id', $donnees->clientId)
            ->first();

        if ($ticket === null) {
            return null;
        }

        $premier = $ticket->messages()->first();

        if ($ticket->subject !== $donnees->subject || $ticket->space !== $donnees->space || $ticket->category !== $donnees->category || $ticket->organization_id !== $adhesion?->organizationId
            || $premier === null || ! $this->poster->matches($premier, false, $donnees->body, $donnees->attachments)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $ticket;
    }
}
