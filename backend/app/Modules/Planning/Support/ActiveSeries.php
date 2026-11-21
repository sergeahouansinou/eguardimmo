<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Enums\Recurrence;
use App\Modules\Planning\Models\PlanningEvent;
use Carbon\CarbonImmutable;

/**
 * Plafond de séries récurrentes actives par organisation (`planning.max_active_series`) : une série annulée ou terminée ne compte plus.
 * Le plafond borne la charge de l'agenda sans jamais tronquer silencieusement une période.
 */
final readonly class ActiveSeries
{
    public function __construct(private OrganizationDirectory $organisation) {}

    public function isActive(PlanningEvent $evenement): bool
    {
        return $evenement->recurrence !== Recurrence::None
            && $evenement->cancelled_at === null
            && ($evenement->recurrence_until === null || $evenement->recurrence_until->toDateString() >= $this->today());
    }

    /**
     * À appeler pour une série qui devient active (création, ou récurrence ajoutée ou prolongée) ; sans effet pour un autre événement.
     */
    public function assertRoomFor(PlanningEvent $evenement): void
    {
        if (! $this->isActive($evenement)) {
            return;
        }

        $actives = PlanningEvent::query()
            ->where('recurrence', '!=', Recurrence::None->value)
            ->whereNull('cancelled_at')
            ->where(fn ($q) => $q->whereNull('recurrence_until')->orWhere('recurrence_until', '>=', $this->today()))
            ->count();

        if ($actives >= (int) config('planning.max_active_series')) {
            throw ErrorCode::SeriesLimitReached->problem();
        }
    }

    private function today(): string
    {
        return CarbonImmutable::now($this->organisation->timezone())->toDateString();
    }
}
