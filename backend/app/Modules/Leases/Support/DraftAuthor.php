<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use Illuminate\Contracts\Auth\Factory;

final readonly class DraftAuthor
{
    public function __construct(private Factory $auth) {}

    public function id(): ?string
    {
        $identifiant = $this->auth->guard()->id();

        return is_string($identifiant) ? $identifiant : null;
    }
}
