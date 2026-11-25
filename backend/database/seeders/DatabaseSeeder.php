<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Catalog\PublicApi\PlatformCatalog;
use App\Modules\Geography\PublicApi\GeographyCatalog;
use App\Modules\Identity\Models\User;
use App\Modules\Subscriptions\PublicApi\PlanCatalog;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

final class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        app(PlatformCatalog::class)->seed();
        app(PlanCatalog::class)->seed();
        app(GeographyCatalog::class)->seed();

        if (! app()->environment('local', 'testing')) {
            return;
        }

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);
    }
}
