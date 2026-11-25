<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Data\ReminderSettings;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\ReminderCode;
use App\Modules\Notifications\Models\ReminderRule;

final class ReminderRules
{
    /**
     * @return list<ReminderSettings> un réglage par rappel du catalogue, dans son ordre
     */
    public function all(): array
    {
        $lignes = ReminderRule::query()->get()->keyBy(fn (ReminderRule $ligne): string => $ligne->code->value);

        return array_map(fn (ReminderCode $code): ReminderSettings => $this->shape($code, $lignes->get($code->value)), ReminderCode::cases());
    }

    public function for(ReminderCode $code): ReminderSettings
    {
        return $this->shape($code, ReminderRule::query()->where('code', $code->value)->first());
    }

    private function shape(ReminderCode $code, ?ReminderRule $ligne): ReminderSettings
    {
        $defauts = $code->defaults();

        if ($ligne === null) {
            return new ReminderSettings($code, false, $defauts['delay'], $defauts['repeat'], $defauts['occurrences'], $code->availableChannels());
        }

        return new ReminderSettings(
            $code,
            $ligne->enabled,
            $ligne->delay_days,
            $ligne->repeat_every_days,
            $ligne->max_occurrences,
            array_values(array_filter($code->availableChannels(), fn (NotificationChannel $canal): bool => in_array($canal->value, $ligne->channels, true))),
            $ligne->last_run_at,
            $ligne->last_sent_count,
            $ligne->updated_at,
        );
    }
}
