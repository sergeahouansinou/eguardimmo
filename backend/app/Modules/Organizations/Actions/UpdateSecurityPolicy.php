<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Models\Organization;
use Illuminate\Support\Facades\DB;

final class UpdateSecurityPolicy
{
    public function handle(Organization $organisation, bool $deuxFacteursObligatoire): Organization
    {
        return DB::transaction(function () use ($organisation, $deuxFacteursObligatoire): Organization {
            $organisation->forceFill(['two_factor_required' => $deuxFacteursObligatoire])->save();

            return $organisation;
        });
    }
}
