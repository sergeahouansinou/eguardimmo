<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Data\EventChangesData;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Support\ActiveSeries;
use App\Modules\Planning\Support\EventAttendees;
use App\Modules\Planning\Support\EventRules;
use App\Modules\Planning\Support\LinkResolver;
use App\Modules\Planning\Support\Reminders;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

final readonly class UpdateEvent
{
    private const array CHAMPS = ['kind', 'title', 'notes', 'starts_on', 'start_time', 'recurrence', 'recurrence_until', 'reminder_offset_minutes', 'property_id', 'unit_id', 'lease_id'];

    private const array LIENS = ['property_id', 'unit_id', 'lease_id'];

    public function __construct(
        private LinkResolver $liens,
        private EventAttendees $participants,
        private OrganizationDirectory $organisation,
        private ActiveSeries $series,
    ) {}

    /**
     * Une modification vaut pour toute la série. Le fuseau copié à la création est conservé tant que l'événement reste horodaté.
     */
    public function handle(PlanningEvent $event, EventChangesData $changements): PlanningEvent
    {
        $fuseau = $this->organisation->timezone();

        return DB::transaction(function () use ($event, $changements, $fuseau): PlanningEvent {
            $evenement = PlanningEvent::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

            if ($evenement->cancelled_at !== null) {
                throw ErrorCode::EventCancelled->problem();
            }

            if ($evenement->lock_version !== $changements->lockVersion) {
                throw ErrorCode::VersionConflict->problem();
            }

            $etaitActive = $this->series->isActive($evenement);
            $champs = Arr::only($changements->fields, self::CHAMPS);
            $evenement->fill($champs);

            EventRules::assertCoherent($evenement->starts_on->toDateString(), $evenement->recurrence, $evenement->recurrence_until?->toDateString());

            $etaitActive || $this->series->assertRoomFor($evenement);

            if (array_intersect(self::LIENS, array_keys($champs)) !== []) {
                $liens = $this->liens->resolve($evenement->property_id, $evenement->unit_id, $evenement->lease_id);
                $evenement->fill(['property_id' => $liens->propertyId, 'unit_id' => $liens->unitId, 'lease_id' => $liens->leaseId]);
            }

            if ($changements->attendeeUserIds !== null || $changements->attendeePartyIds !== null) {
                $this->participants->assertValid($changements->attendeeUserIds ?? $this->courants($evenement, true), $changements->attendeePartyIds ?? $this->courants($evenement, false));
            }

            $evenement->timezone = $evenement->start_time === null ? null : ($evenement->timezone ?? $fuseau);
            $evenement->lock_version = $changements->lockVersion + 1;
            $evenement->next_reminder_at = Reminders::eventAfter($evenement, CarbonImmutable::now(), $fuseau)?->at;
            $evenement->save();

            if ($changements->attendeeUserIds !== null || $changements->attendeePartyIds !== null) {
                $this->participants->sync($evenement, $changements->attendeeUserIds ?? $this->courants($evenement, true), $changements->attendeePartyIds ?? $this->courants($evenement, false));
            }

            return $evenement;
        });
    }

    /**
     * @return list<string>
     */
    private function courants(PlanningEvent $evenement, bool $membres): array
    {
        return array_values(array_map(strval(...), $evenement->attendees()->whereNotNull($membres ? 'user_id' : 'party_id')->pluck($membres ? 'user_id' : 'party_id')->all()));
    }
}
