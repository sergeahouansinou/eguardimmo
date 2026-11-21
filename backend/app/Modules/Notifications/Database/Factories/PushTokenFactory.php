<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Database\Factories;

use App\Modules\Notifications\Enums\PushPlatform;
use App\Modules\Notifications\Models\PushToken;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PushToken>
 */
final class PushTokenFactory extends Factory
{
    protected $model = PushToken::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $jeton = Str::random(152);

        return [
            'platform' => PushPlatform::Android,
            'token' => $jeton,
            'token_hash' => PushToken::hash($jeton),
            'device_name' => 'Pixel de test',
        ];
    }
}
