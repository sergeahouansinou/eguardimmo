<?php

declare(strict_types=1);

namespace App\Shared\Tenancy;

use Closure;

final class CurrentOrganization
{
    private ?int $id = null;

    public function set(int $id): void
    {
        if ($this->id !== null && $this->id !== $id) {
            throw new OrganizationMismatch("Organisation courante déjà fixée à [{$this->id}], refus de passer à [{$id}].");
        }

        $this->id = $id;
    }

    public function id(): int
    {
        return $this->id ?? throw MissingOrganizationContext::make();
    }

    public function has(): bool
    {
        return $this->id !== null;
    }

    /**
     * @template TReturn
     *
     * @param  Closure(): TReturn  $callback
     * @return TReturn
     */
    public function run(int $id, Closure $callback): mixed
    {
        $precedent = $this->id;
        $this->id = $id;

        try {
            return $callback();
        } finally {
            $this->id = $precedent;
        }
    }
}
