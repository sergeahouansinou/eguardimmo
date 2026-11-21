<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Data\NewEventData;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Support\ActiveSeries;
use App\Modules\Planning\Support\EventAttendees;
use App\Modules\Planning\Support\EventRules;
use App\Modules\Planning\Support\LinkResolver;
use App\Modules\Planning\Support\Reminders;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class CreateEvent
{
    public function __construct(
        private LinkResolver $liens,
        private EventAttendees $participants,
        private OrganizationDirectory $organisation,
        private ActiveSeries $series,
    ) {}

    /**
     * Le fuseau de l'organisation est copié sur l'événement horodaté : changer ensuite le fuseau de l'organisation ne le déplace pas.
     */
    public function handle(string $userId, NewEventData $donnees): PlanningEvent
    {
        EventRules::assertCoherent($donnees->startsOn, $donnees->recurrence, $donnees->recurrenceUntil);
        $liens = $this->liens->resolve($donnees->propertyId, $donnees->unitId, $donnees->leaseId);
        $this->participants->assertValid($donnees->attendeeUserIds, $donnees->attendeePartyIds);
        $fuseau = $this->organisation->timezone();

        return DB::transaction(function () use ($userId, $donnees, $liens, $fuseau): PlanningEvent {
            $evenement = new PlanningEvent([
                'kind' => $donnees->kind,
                'title' => $donnees->title,
                'notes' => $donnees->notes,
                'starts_on' => $donnees->startsOn,
                'start_time' => $donnees->startTime,
                'timezone' => $donnees->startTime === null ? null : $fuseau,
                'recurrence' => $donnees->recurrence,
                'recurrence_until' => $donnees->recurrenceUntil,
                'reminder_offset_minutes' => $donnees->reminderOffsetMinutes,
                'property_id' => $liens->propertyId,
                'unit_id' => $liens->unitId,
                'lease_id' => $liens->leaseId,
                'created_by_user_id' => $userId,
                'lock_version' => 1,
            ]);
            $this->series->assertRoomFor($evenement);
            $evenement->next_reminder_at = Reminders::eventAfter($evenement, CarbonImmutable::now(), $fuseau)?->at;
            $evenement->save();

            $this->participants->sync($evenement, $donnees->attendeeUserIds, $donnees->attendeePartyIds);

            return $evenement;
        });
    }
}
