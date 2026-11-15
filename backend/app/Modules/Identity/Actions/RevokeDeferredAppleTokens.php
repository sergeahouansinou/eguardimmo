<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Models\SocialIdentity;
use Illuminate\Database\Eloquent\Builder;

final readonly class RevokeDeferredAppleTokens
{
    public function __construct(private AttemptAppleRevocation $tentative) {}

    /**
     * @return array{revoked: int, failed: int}
     */
    public function handle(): array
    {
        $bilan = ['revoked' => 0, 'failed' => 0];

        SocialIdentity::query()
            ->where('provider', SocialProvider::Apple->value)
            ->whereNotNull('apple_refresh_token')
            ->whereHas('user', fn (Builder $q) => $q->onlyTrashed())
            ->lazyById()
            ->each(function (SocialIdentity $identite) use (&$bilan): void {
                $bilan[$this->tentative->handle($identite) ? 'revoked' : 'failed']++;
            });

        return $bilan;
    }
}
