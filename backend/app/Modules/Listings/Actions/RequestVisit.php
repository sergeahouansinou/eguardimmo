<?php

declare(strict_types=1);

namespace App\Modules\Listings\Actions;

use App\Modules\Listings\Data\VisitRequestData;
use App\Modules\Listings\Enums\LeadStatus;
use App\Modules\Listings\Events\VisitRequested;
use App\Modules\Listings\Models\ListingLead;
use App\Modules\Listings\Queries\PublicListings;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class RequestVisit
{
    public function __construct(
        private PublicListings $annonces,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * La demande appartient à l'organisation de l'annonce, jamais à une organisation désignée par le client.
     */
    public function handle(string $userId, string $ref, VisitRequestData $donnees): ListingLead
    {
        $annonce = $this->annonces->published($ref);

        return $this->contexte->run($annonce->organization_id, fn (): ListingLead => DB::transaction(function () use ($annonce, $userId, $donnees): ListingLead {
            $demande = ListingLead::query()->create([
                'listing_id' => $annonce->id,
                'user_id' => $userId,
                'requested_slot' => $donnees->requestedSlot,
                'message' => $donnees->message,
                'status' => LeadStatus::New,
            ]);

            VisitRequested::dispatch($demande->id, $annonce->organization_id, $annonce->id, $userId);

            return $demande;
        }));
    }
}
