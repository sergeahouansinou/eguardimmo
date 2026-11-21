<?php

declare(strict_types=1);

namespace Tests\Feature\Recovery;

use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Recovery\Mail\BundleLinkMail;
use App\Modules\Rent\Support\IssuerIdentity;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Invoicing\InvoicingContext as I;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Parties\PartiesContext as P;
use Tests\Feature\Rent\RentContext as C;

final class RecoveryContext
{
    public const string LIEN = 'https://liens.example.test/transmission/{token}';

    public static function preparer(object $test): void
    {
        C::preparer($test);
        config(['recovery.gotenberg.url' => 'http://gotenberg.test', 'recovery.transmission.link_url' => self::LIEN]);
        Mail::fake();
    }

    /**
     * Passe au titulaire d'une autre organisation : le contexte courant et l'émetteur mis en cache sont oubliés.
     */
    public static function basculer(object $test, Organization $org): void
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);
        app()->forgetInstance(IssuerIdentity::class);
        $test->actingAs(L::titulaire($org));
    }

    public static function url(Organization $organisation, string $chemin = ''): string
    {
        return "/api/v1/org/{$organisation->id}/recovery{$chemin}";
    }

    /**
     * Agence, bail signé et trois échéances émises (septembre à novembre 2026) toutes impayées au 16 novembre.
     *
     * @return array{org: Organization, bail: Lease, locataire: Party, ids: list<string>}
     */
    public static function impayes(object $test, ?Organization $organisation = null, string $nom = 'Agence du Port'): array
    {
        $org = $organisation ?? C::organisation(nom: $nom);
        self::basculer($test, $org);
        ['bail' => $bail, 'locataire' => $locataire] = C::bail($org);

        foreach (['2026-09-16', '2026-10-16', '2026-11-16'] as $jour) {
            C::emises($org, $bail, $test, $jour);
        }

        $ids = array_map(fn ($e): string => $e->id, C::echeances($org, $bail));

        return ['org' => $org, 'bail' => $bail, 'locataire' => $locataire, 'ids' => $ids];
    }

    /**
     * Facture de bail (120,00 EUR TTC) émise le 1er octobre au locataire, échue à $echeance ; retourne son identifiant.
     * Le temps repart ensuite au jour des scénarios (16 novembre).
     *
     * @param  list<array<string, mixed>>|null  $lignes
     */
    public static function facturer(object $test, Organization $org, Lease $bail, Party $locataire, string $echeance = '2026-10-15', ?array $lignes = null): string
    {
        config(['invoicing.gotenberg.url' => 'http://gotenberg.test']);
        I::identite($org);
        self::basculer($test, $org);
        $test->travelTo(CarbonImmutable::parse('2026-10-01 10:00:00'));
        $id = $test->postJson(I::url($org), I::brouillon($locataire, $lignes, ['lease_id' => $bail->id, 'due_on' => $echeance]))->assertCreated()->json('data.id');
        $test->postJson(I::url($org, "/{$id}/issue"))->assertCreated();
        $test->travelTo(CarbonImmutable::parse(C::AUJOURDHUI));

        return $id;
    }

    /**
     * @param  list<string>  $ids
     * @param  list<string>  $factures
     */
    public static function ouvrir(object $test, Organization $org, Lease $bail, Party $locataire, array $ids, array $factures = []): TestResponse
    {
        self::basculer($test, $org);

        return $test->postJson(self::url($org, '/cases'), ['lease_id' => $bail->id, 'debtor_party_id' => $locataire->id, 'installment_ids' => $ids, ...($factures === [] ? [] : ['invoice_ids' => $factures])]);
    }

    public static function bailiff(object $test, Organization $org, ?string $email = 'etude@martin-cj.fr', string $nom = 'Étude Martin'): string
    {
        self::basculer($test, $org);
        $id = $test->postJson(P::url($org), ['kind' => 'company', 'company_name' => $nom, 'contact_category_ids' => [P::terme('contact_category', 'bailiff')->id]])->assertCreated()->json('data.id');

        if ($email !== null) {
            $test->postJson(P::url($org, "/{$id}/contact-points"), ['type' => 'email', 'value' => $email])->assertCreated();
        }

        return $id;
    }

    /**
     * Jeton lu dans l'e-mail envoyé : le seul endroit où il existe en clair.
     */
    public static function jeton(): string
    {
        $mail = Mail::sent(BundleLinkMail::class)->last();

        return substr((string) strrchr($mail->lien, '/'), 1);
    }

    /**
     * Scénario d'impayés avec un dossier ouvert sur les premières échéances.
     *
     * @return array{org: Organization, bail: Lease, locataire: Party, ids: list<string>, case: string}
     */
    public static function dossier(object $test, int $nombre = 3): array
    {
        $s = self::impayes($test);
        $id = self::ouvrir($test, $s['org'], $s['bail'], $s['locataire'], array_slice($s['ids'], 0, $nombre))->assertCreated()->json('data.id');

        return [...$s, 'case' => $id];
    }

    /**
     * @param  array{org: Organization, case: string}  $s
     */
    public static function envoi(object $test, array $s): string
    {
        self::basculer($test, $s['org']);

        return $test->postJson(self::url($s['org'], "/cases/{$s['case']}/bundles"))->assertCreated()->json('data.id');
    }

    /**
     * Dossier, envoi et transmission au commissaire de justice ; retourne aussi le jeton lu dans l'e-mail.
     *
     * @return array{org: Organization, bail: Lease, locataire: Party, ids: list<string>, case: string, bundle: string, transmission: string, token: string, bailiff: string}
     */
    public static function transmis(object $test): array
    {
        $s = self::dossier($test);
        $bundle = self::envoi($test, $s);
        $bailiff = self::bailiff($test, $s['org']);
        $transmission = $test->postJson(self::url($s['org'], "/bundles/{$bundle}/transmissions"), ['recipient_party_id' => $bailiff])->assertCreated()->json('data.id');

        return [...$s, 'bundle' => $bundle, 'transmission' => $transmission, 'token' => self::jeton(), 'bailiff' => $bailiff];
    }
}
