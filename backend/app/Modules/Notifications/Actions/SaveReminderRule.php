<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\ReminderSettings;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Models\ReminderRule;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class SaveReminderRule
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(ReminderSettings $reglage, string $operateurId): void
    {
        DB::transaction(function () use ($reglage, $operateurId): void {
            $valeurs = [
                'enabled' => $reglage->enabled,
                'delay_days' => $reglage->delayDays,
                'repeat_every_days' => $reglage->repeatEveryDays,
                'max_occurrences' => $reglage->maxOccurrences,
                'channels' => array_map(fn (NotificationChannel $canal): string => $canal->value, $reglage->channels),
            ];
            $ligne = ReminderRule::query()->where('code', $reglage->code->value)->lockForUpdate()->first()
                ?? (new ReminderRule)->forceFill(['code' => $reglage->code]);
            $ligne->forceFill([...$valeurs, 'updated_by_user_id' => $operateurId])->save();
            $this->audit->handle('console.notifications.reminder_updated', $operateurId, ['code' => $reglage->code->value, ...$valeurs], $ligne);
        });
    }
}
