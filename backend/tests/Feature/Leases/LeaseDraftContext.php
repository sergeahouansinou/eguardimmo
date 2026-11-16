<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use App\Modules\Leases\Actions\CreateLease;
use App\Modules\Leases\Http\Requests\CreateLeaseRequest;
use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Http\ApiProblem;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Routing\Redirector;
use Illuminate\Validation\ValidationException;

final class LeaseDraftContext
{
    /**
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function payload(Unit $lot, Party $partie, array $surcharges = []): array
    {
        return [
            'jurisdiction' => 'FR',
            'regime_key' => 'fr.residential.unfurnished',
            'starts_on' => '2026-03-01',
            'due_day' => 5,
            'periodicity' => 'monthly',
            'billing_timing' => 'advance',
            'units' => [['unit_id' => $lot->id, 'is_main' => true]],
            'parties' => [['party_id' => $partie->id, 'role' => 'tenant', 'joint_liability' => true]],
            'terms' => [['component_term_id' => LeasesContext::composante('rent')->id, 'amount' => 65000, 'indexed' => true]],
            ...$surcharges,
        ];
    }

    /**
     * @template T of FormRequest
     *
     * @param  class-string<T>  $classe
     * @param  array<string, mixed>  $donnees
     * @return T
     *
     * @throws ValidationException
     */
    public static function requete(string $classe, array $donnees): FormRequest
    {
        $requete = $classe::create('/', 'POST', $donnees);
        $requete->setContainer(app())->setRedirector(app(Redirector::class));
        $requete->validateResolved();

        return $requete;
    }

    /**
     * @param  array<string, mixed>  $donnees
     */
    public static function creer(Organization $organisation, array $donnees): Lease
    {
        return LeasesContext::dans($organisation, fn (): Lease => app(CreateLease::class)->handle(
            self::requete(CreateLeaseRequest::class, $donnees)->toData(),
        ));
    }

    /**
     * Code d'erreur métier ("code:statut") ou clés de validation ("validation:a,b"), vide si l'appel réussit.
     *
     * @param  Closure(): mixed  $appel
     */
    public static function refus(Closure $appel): string
    {
        try {
            $appel();
        } catch (ApiProblem $probleme) {
            return $probleme->problemCode.':'.$probleme->status;
        } catch (ValidationException $e) {
            return 'validation:'.implode(',', array_keys($e->errors()));
        }

        return '';
    }

    public static function lotAnnexe(Organization $organisation, Unit $parent): Unit
    {
        return LeasesContext::dans($organisation, fn (): Unit => Unit::factory()->create([
            'property_id' => $parent->property_id,
            'parent_unit_id' => $parent->id,
            'unit_type_term_id' => LeasesContext::terme('unit_type', 'apartment')->id,
        ]));
    }
}
