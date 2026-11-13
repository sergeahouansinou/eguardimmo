<?php

declare(strict_types=1);

namespace App\Shared\Tenancy;

use Illuminate\Database\Eloquent\Model;

/**
 * @mixin Model
 */
trait BelongsToOrganization
{
    public static function bootBelongsToOrganization(): void
    {
        static::addGlobalScope(new OrganizationScope);

        static::creating(static function (Model $modele): void {
            $courante = app(CurrentOrganization::class)->id();
            $fournie = $modele->getAttribute('organization_id');

            if ($fournie === null) {
                $modele->setAttribute('organization_id', $courante);

                return;
            }

            if ((int) $fournie !== $courante) {
                throw new OrganizationMismatch("Création refusée : organisation [{$fournie}] différente de l'organisation courante [{$courante}].");
            }
        });

        static::updating(static function (Model $modele): void {
            if ($modele->isDirty('organization_id')) {
                throw new OrganizationMismatch('organization_id est immuable.');
            }
        });
    }
}
