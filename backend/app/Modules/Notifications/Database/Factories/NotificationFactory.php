<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Database\Factories;

use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\Notification;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * `user_id` et `organization_id` viennent d'autres modules : l'appelant fournit des lignes réelles.
 *
 * @extends Factory<Notification>
 */
final class NotificationFactory extends Factory
{
    protected $model = Notification::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'audience' => NotificationAudience::Staff,
            'type' => NotificationType::RentOverdue,
            'dedup_key' => Str::uuid7()->toString(),
            'title' => 'Loyer en retard',
            'body' => 'Une échéance du bail BL-0001 n\'est pas soldée.',
            'link' => '/finances/impayes',
            'in_app' => true,
            'email' => false,
            'push' => false,
        ];
    }
}
