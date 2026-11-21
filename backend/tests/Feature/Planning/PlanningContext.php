<?php

declare(strict_types=1);

namespace Tests\Feature\Planning;

use App\Modules\Organizations\Models\Organization;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningTask;
use Tests\Feature\Properties\PropertiesContext as C;

final class PlanningContext
{
    public static function url(Organization $organisation, string $chemin = ''): string
    {
        return C::url($organisation, "/planning{$chemin}");
    }

    /**
     * @param  array<string, mixed>  $corps
     * @return array<string, mixed>
     */
    public static function evenement(array $corps = []): array
    {
        return ['kind' => 'appointment', 'title' => 'Rendez-vous syndic', 'starts_on' => '2026-12-01', 'start_time' => '10:00', ...$corps];
    }

    /**
     * @param  array<string, mixed>  $corps
     * @return array<string, mixed>
     */
    public static function tache(array $corps = []): array
    {
        return ['title' => 'Relancer le syndic', 'due_on' => '2026-12-01', ...$corps];
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function creerEvenement(Organization $organisation, array $attributs = []): PlanningEvent
    {
        return C::dans($organisation, fn (): PlanningEvent => PlanningEvent::factory()->create($attributs));
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function creerTache(Organization $organisation, array $attributs = []): PlanningTask
    {
        return C::dans($organisation, fn (): PlanningTask => PlanningTask::factory()->create($attributs));
    }
}
