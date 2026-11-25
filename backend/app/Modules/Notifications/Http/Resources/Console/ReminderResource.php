<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources\Console;

use App\Modules\Notifications\Data\ReminderSettings;
use App\Modules\Notifications\Enums\NotificationChannel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property ReminderSettings $resource
 */
final class ReminderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $code = $this->resource->code;
        $bornes = $code->defaults();
        $valeurs = fn (array $canaux): array => array_map(fn (NotificationChannel $canal): string => $canal->value, $canaux);

        return [
            'code' => $code->value,
            'label' => $code->label(),
            'description' => $code->description(),
            'category' => $code->category()->value,
            'category_label' => $code->category()->label(),
            'timing' => $code->timing()->value,
            'enabled' => $this->resource->enabled,
            'delay_days' => $this->resource->delayDays,
            'delay_min' => $bornes['min'],
            'delay_max' => $bornes['max'],
            'repeat_every_days' => $this->resource->repeatEveryDays,
            'max_occurrences' => $this->resource->maxOccurrences,
            'occurrences_limit' => $code->occurrencesLimit(),
            'channels' => $valeurs($this->resource->channels),
            'available_channels' => $valeurs($code->availableChannels()),
            'last_run_at' => $this->resource->lastRunAt?->toIso8601String(),
            'last_sent_count' => $this->resource->lastSentCount,
            'updated_at' => $this->resource->updatedAt?->toIso8601String(),
        ];
    }
}
