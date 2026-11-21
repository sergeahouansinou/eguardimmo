<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningEventAttendee;
use App\Shared\Http\ApiProblem;

/**
 * Participants d'un événement : 20 au plus, membres actifs ou fiches de contact de l'organisation, jamais un nom libre.
 */
final readonly class EventAttendees
{
    public const int MAX = 20;

    public function __construct(
        private Assignees $membres,
        private PartyDirectory $parties,
    ) {}

    /**
     * @param  list<string>  $userIds
     * @param  list<string>  $partyIds
     */
    public function assertValid(array $userIds, array $partyIds): void
    {
        if (count($userIds) + count($partyIds) > self::MAX) {
            throw ErrorCode::LinkInvalid->problem();
        }

        $this->membres->assertAllActive($userIds);

        try {
            $fiches = $this->parties->findMany($partyIds);
        } catch (ApiProblem) {
            throw ErrorCode::LinkInvalid->problem();
        }

        foreach ($fiches as $fiche) {
            ! $fiche->isAnonymized && ! $fiche->isArchived || throw ErrorCode::LinkInvalid->problem();
        }
    }

    /**
     * @param  list<string>  $userIds
     * @param  list<string>  $partyIds
     */
    public function sync(PlanningEvent $event, array $userIds, array $partyIds): void
    {
        $existants = PlanningEventAttendee::query()->where('event_id', $event->id)->get();

        foreach ($existants as $ligne) {
            $garde = $ligne->user_id !== null ? in_array($ligne->user_id, $userIds, true) : in_array($ligne->party_id, $partyIds, true);
            $garde || $ligne->delete();
        }

        $presents = $existants->map(fn (PlanningEventAttendee $l): string => (string) ($l->user_id ?? $l->party_id))->all();

        foreach ($userIds as $id) {
            in_array($id, $presents, true) || PlanningEventAttendee::query()->create(['event_id' => $event->id, 'user_id' => $id]);
        }

        foreach ($partyIds as $id) {
            in_array($id, $presents, true) || PlanningEventAttendee::query()->create(['event_id' => $event->id, 'party_id' => $id]);
        }
    }
}
