<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Database\Seeders;

use App\Modules\Catalog\Actions\SeedPlatformTerms;
use Illuminate\Database\Seeder;

final class PlatformTermsSeeder extends Seeder
{
    public function run(SeedPlatformTerms $semer): void
    {
        $semer->handle();
    }
}
