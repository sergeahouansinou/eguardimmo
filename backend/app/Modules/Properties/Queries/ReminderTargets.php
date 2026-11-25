<?php

declare(strict_types=1);

namespace App\Modules\Properties\Queries;

use App\Modules\Properties\Models\Property;
use App\Shared\Reminders\ReminderHit;
use App\Shared\Reminders\ReminderRegistry;
use App\Shared\Reminders\ReminderWindow;
use App\Shared\Tenancy\AcrossOrganizations;
use Generator;
use Illuminate\Support\LazyCollection;

final readonly class ReminderTargets
{
    public function __construct(private ReminderRegistry $rappels) {}

    /**
     * Organisations sans aucun bien actif (ADR 0042) ; départ : la création de l'organisation.
     *
     * @return iterable<ReminderHit>
     */
    public function organizationsWithoutProperty(ReminderWindow $fenetre): iterable
    {
        foreach (LazyCollection::make(fn (): Generator => $this->organisations($fenetre))->chunk(500) as $paquet) {
            $pourvues = AcrossOrganizations::query(Property::class)->whereNull('archived_at')
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
     * @return Generator<int, ReminderHit>
     */
    private function organisations(ReminderWindow $fenetre): Generator
    {
        foreach ($this->rappels->organizationsCreated($fenetre) as $cas) {
            yield $cas;
        }
    }
}
