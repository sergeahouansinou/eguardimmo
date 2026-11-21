<?php

declare(strict_types=1);

namespace App\Modules\Planning\Queries;

use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningTask;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

final readonly class DueReminders
{
    private const int LOT = 200;

    /**
     * Organisations qui ont un rappel échu, événement ou tâche.
     *
     * @return list<string>
     */
    public function organizations(CarbonImmutable $maintenant): array
    {
        $limite = $maintenant->format('Y-m-d H:i:s.u');
        $ids = [];

        foreach ([PlanningEvent::class, PlanningTask::class] as $modele) {
            foreach (AcrossOrganizations::query($modele)->where('next_reminder_at', '<=', $limite)->distinct()->pluck('organization_id') as $id) {
                $ids[(string) $id] = true;
            }
        }

        $liste = array_keys($ids);
        sort($liste);

        return $liste;
    }

    /**
     * Sous le contexte d'une organisation.
     *
     * @return list<string>
     */
    public function eventIds(CarbonImmutable $maintenant): array
    {
        return $this->ids(PlanningEvent::query(), $maintenant);
    }

    /**
     * Sous le contexte d'une organisation.
     *
     * @return list<string>
     */
    public function taskIds(CarbonImmutable $maintenant): array
    {
        return $this->ids(PlanningTask::query(), $maintenant);
    }

    /**
     * @template T of Model
     *
     * @param  Builder<T>  $requete
     * @return list<string>
     */
    private function ids(Builder $requete, CarbonImmutable $maintenant): array
    {
        return array_values(array_map(strval(...), $requete
            ->where('next_reminder_at', '<=', $maintenant->format('Y-m-d H:i:s.u'))
            ->orderBy('next_reminder_at')->orderBy('id')->limit(self::LOT)->pluck('id')->all()));
    }
}
