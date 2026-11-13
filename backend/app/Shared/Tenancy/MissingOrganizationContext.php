<?php

declare(strict_types=1);

namespace App\Shared\Tenancy;

use RuntimeException;

final class MissingOrganizationContext extends RuntimeException
{
    public static function make(): self
    {
        return new self('Aucune organisation courante : requête refusée.');
    }
}
