<?php

declare(strict_types=1);

namespace App\Modules\Listings\Queries;

use App\Modules\Listings\Enums\LeadStatus;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Models\ListingLead;
use App\Shared\Reminders\ReminderHit;
use App\Shared\Reminders\ReminderRegistry;
use App\Shared\Reminders\ReminderWindow;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Generator;
use Illuminate\Support\LazyCollection;

/**
 * Déclencheurs de rappel des annonces (ADR 0042).
 */
final readonly class ReminderTargets
{
    public function __construct(private ReminderRegistry $rappels) {}

    /**
     * @return iterable<ReminderHit> départ : la création de l'organisation
     */
    public function organizationsWithoutListing(ReminderWindow $fenetre): iterable
    {
        foreach (LazyCollection::make(fn (): Generator => $this->organisations($fenetre))->chunk(500) as $paquet) {
            $pourvues = AcrossOrganizations::query(Listing::class)
                ->whereIn('organization_id', $paquet->map(fn (ReminderHit $cas): ?string => $cas->organizationId)->values()->all())
                ->distinct()->pluck('organization_id')->flip();

            foreach ($paquet as $cas) {
                if (! $pourvues->has((string) $cas->organizationId)) {
                    yield $cas;
                }
            }
        }
    }

    /**
     * @return iterable<ReminderHit> départ : la dernière modification du brouillon
     */
    public function drafts(ReminderWindow $fenetre): iterable
    {
        return AcrossOrganizations::query(Listing::class)->where('status', ListingStatus::Draft->value)
            ->where('updated_at', '>=', $fenetre->from->format('Y-m-d H:i:s.u'))
            ->where('updated_at', '<=', $fenetre->to->format('Y-m-d H:i:s.u'))
            ->select(['id', 'organization_id', 'updated_at'])->lazyById(500)
            ->map(fn (Listing $annonce): ReminderHit => new ReminderHit(
                $annonce->id,
                CarbonImmutable::parse($annonce->getAttribute('updated_at')),
                organizationId: $annonce->organization_id,
            ));
    }

    /**
     * @return iterable<ReminderHit> départ : la réception de la demande
     */
    public function unansweredLeads(ReminderWindow $fenetre): iterable
    {
        return AcrossOrganizations::query(ListingLead::class)->where('status', LeadStatus::New->value)
            ->where('created_at', '>=', $fenetre->from->format('Y-m-d H:i:s.u'))
            ->where('created_at', '<=', $fenetre->to->format('Y-m-d H:i:s.u'))
            ->select(['id', 'organization_id', 'created_at'])->lazyById(500)
            ->map(fn (ListingLead $demande): ReminderHit => new ReminderHit(
                $demande->id,
                CarbonImmutable::parse($demande->created_at),
                organizationId: $demande->organization_id,
            ));
    }

    /**
     * @return Generator<int, ReminderHit>
     */
    private function organisations(ReminderWindow $fenetre): Generator
    {
        foreach ($this->rappels->organizationsCreated($fenetre) as $cas) {
            yield $cas;
        }
    }
}
