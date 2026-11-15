<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Actions\IssueMobileToken;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Collection;

final class MobileDevices
{
    /**
     * @return Collection<int, PersonalAccessToken>
     */
    public function for(User $user): Collection
    {
        /** @var Collection<int, PersonalAccessToken> */
        return $user->tokens()
            ->where('abilities', 'like', '%"'.IssueMobileToken::CAPACITE.'"%')
            ->latest('id')
            ->get();
    }
}
