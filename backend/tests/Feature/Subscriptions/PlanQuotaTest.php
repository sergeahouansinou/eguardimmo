<?php

declare(strict_types=1);

use App\Modules\Leases\Actions\RestoreLease;
use App\Modules\Leases\Models\Lease;
use App\Modules\Properties\Actions\CreateUnit;
use App\Modules\Properties\Actions\RestoreUnit;
use App\Modules\Properties\Data\NewUnitData;
use App\Modules\Properties\Models\Unit;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Http\Middleware\RequireEntitlement;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use App\Shared\Tenancy\MissingOrganizationContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Leases\LeaseDraftContext as D;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Properties\PropertiesContext as P;
use Tests\Feature\Subscriptions\QuotaContext as Q;

beforeEach(function (): void {
    Mail::fake();
    Q::demarrer();
    $this->org = Q::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->autre = Q::organisation();
    $this->autreTitulaire = L::titulaire($this->autre);
});

it('crée sous la limite du plan Gratuit', function (string $nom): void {
    $r = Q::ressources()[$nom];
    Q::gratuit($this->org);
    Q::remplir($this->org, $r, $r['limite'] - 1);

    if ($r['compter']($this->org) > $r['limite'] - 1) {
        Q::deroger($this->org, $r['feature'], $r['compter']($this->org) + 1);
    }

    $avant = $r['compter']($this->org);
    $r['creer']($this, $this->org, $this->titulaire)->assertCreated();
    expect($r['compter']($this->org))->toBe($avant + 1);
})->with(['lots', 'baux', 'etats des lieux', 'utilisateurs']);

it('refuse à la limite avec 409 plan_quota_reached, feature, limit et current, sans rien créer, lecture ouverte', function (string $nom): void {
    $r = Q::ressources()[$nom];
    Q::gratuit($this->org);
    Q::remplir($this->org, $r, $r['limite']);

    $reponse = $r['creer']($this, $this->org, $this->titulaire)->assertStatus(409);

    expect($reponse->json())->toMatchArray(['code' => 'plan_quota_reached', 'status' => 409, 'feature' => $r['feature']->value, 'limit' => $r['limite'], 'current' => $r['limite']])
        ->and($reponse->headers->get('Content-Type'))->toContain('application/problem+json')
        ->and($reponse->json('detail'))->toContain('Silver')
        ->and($r['compter']($this->org))->toBe($r['limite']);
    Q::comme($this, $this->titulaire)->getJson(P::url($this->org, $r['lire']))->assertOk();
})->with(['lots', 'baux', 'etats des lieux', 'utilisateurs']);

it('relève la limite par dérogation, puis refuse à la nouvelle limite', function (string $nom): void {
    $r = Q::ressources()[$nom];
    Q::gratuit($this->org);
    Q::remplir($this->org, $r, $r['limite']);
    $r['creer']($this, $this->org, $this->titulaire)->assertStatus(409);

    Q::deroger($this->org, $r['feature'], $r['limite'] + 2);

    $r['creer']($this, $this->org, $this->titulaire)->assertCreated();
    $r['creer']($this, $this->org, $this->titulaire)->assertCreated();
    $this->assertSame($r['limite'] + 2, $r['compter']($this->org));
    $r['creer']($this, $this->org, $this->titulaire)->assertStatus(409)
        ->assertJsonPath('code', 'plan_quota_reached')->assertJsonPath('limit', $r['limite'] + 2)->assertJsonPath('current', $r['limite'] + 2);
})->with(['lots', 'baux', 'etats des lieux', 'utilisateurs']);

it('lève la limite avec une dérogation illimitée et refuse net une fonction désactivée avec 403 feature_not_in_plan', function (string $nom): void {
    $r = Q::ressources()[$nom];
    Q::gratuit($this->org);
    Q::remplir($this->org, $r, $r['limite']);

    Q::deroger($this->org, $r['feature'], null);
    $r['creer']($this, $this->org, $this->titulaire)->assertCreated();

    Q::deroger($this->org, $r['feature'], null, false);
    $r['creer']($this, $this->org, $this->titulaire)->assertForbidden()
        ->assertJsonPath('code', 'feature_not_in_plan')->assertJsonPath('feature', $r['feature']->value);
})->with(['lots', 'baux', 'etats des lieux', 'utilisateurs']);

it('ne limite pas une organisation sans abonnement', function (string $nom): void {
    $r = Q::ressources()[$nom];
    Q::sansAbonnement($this->org);
    Q::remplir($this->org, $r, $r['limite'] + 3);

    $avant = $r['compter']($this->org);
    $r['creer']($this, $this->org, $this->titulaire)->assertCreated();
    expect($r['compter']($this->org))->toBe($avant + 1);
})->with(['lots', 'baux', 'etats des lieux', 'utilisateurs']);

it('compte par organisation : le plafond et les objets d\'une autre organisation ne comptent pas', function (string $nom): void {
    $r = Q::ressources()[$nom];
    Q::gratuit($this->org);
    Q::remplir($this->org, $r, $r['limite']);
    Q::remplir($this->autre, $r, $r['limite'] + 2);

    $r['creer']($this, $this->autre, $this->autreTitulaire)->assertCreated();
    $r['creer']($this, $this->org, $this->titulaire)->assertStatus(409)->assertJsonPath('current', $r['limite']);
    expect($r['compter']($this->org))->toBe($r['limite']);

    Q::gratuit($this->autre);
    $r['creer']($this, $this->autre, $this->autreTitulaire)->assertStatus(409)->assertJsonPath('current', $r['compter']($this->autre));
})->with(['lots', 'baux', 'etats des lieux', 'utilisateurs']);

it('serre la dernière place : de deux créations successives, une seule passe (la concurrence réelle n\'est pas testable sous SQLite)', function (string $nom): void {
    $r = Q::ressources()[$nom];
    Q::gratuit($this->org);
    Q::remplir($this->org, $r, $r['limite'] - 1);

    if ($r['compter']($this->org) > $r['limite'] - 1) {
        Q::deroger($this->org, $r['feature'], $r['compter']($this->org) + 1);
    }

    $limite = $r['compter']($this->org) + 1;
    $statuts = [
        $r['creer']($this, $this->org, $this->titulaire)->getStatusCode(),
        $r['creer']($this, $this->org, $this->titulaire)->getStatusCode(),
    ];

    expect($statuts)->toBe([201, 409])->and($r['compter']($this->org))->toBe($limite);
})->with(['lots', 'baux', 'etats des lieux', 'utilisateurs']);

it('rejoue un état des lieux de même clé sans le compter deux fois, même à la limite', function (): void {
    $r = Q::ressources()['etats des lieux'];
    Q::gratuit($this->org);
    Q::remplir($this->org, $r, $r['limite'] - 1);
    $bail = L::bail($this->org)->id;
    $cle = (string) Str::uuid7();

    $id = Q::enregistrer($this, $this->org, $this->titulaire, ['client_id' => $cle, '_bail' => $bail])->assertCreated()->json('data.id');
    expect($r['compter']($this->org))->toBe($r['limite']);

    Q::enregistrer($this, $this->org, $this->titulaire, ['client_id' => $cle, '_bail' => $bail])->assertOk()->assertJsonPath('data.id', $id);
    expect($r['compter']($this->org))->toBe($r['limite']);

    Q::enregistrer($this, $this->org, $this->titulaire, ['_bail' => $bail])->assertStatus(409)->assertJsonPath('code', 'plan_quota_reached');
});

it('compte de nouveau un lot ou un bail restauré : 409 à la limite, restauration permise dessous ou par dérogation', function (string $nom, string $archive): void {
    $r = Q::ressources()[$nom];
    $objet = $r['ajouter']($this->org);
    L::dans($this->org, fn () => $objet->forceFill(['archived_at' => now()])->save());
    Q::gratuit($this->org);
    Q::remplir($this->org, $r, $r['limite']);
    $url = P::url($this->org, "{$r['lire']}/{$objet->id}/archive");
    $actif = L::dans($this->org, fn () => ($objet instanceof Unit ? Unit::class : Lease::class)::query()->whereNull('archived_at')->firstOrFail());

    Q::comme($this, $this->titulaire)->deleteJson(P::url($this->org, "{$r['lire']}/{$actif->id}/archive"))->assertOk();
    Q::comme($this, $this->titulaire)->deleteJson($url)->assertStatus(409)
        ->assertJsonPath('code', 'plan_quota_reached')->assertJsonPath('feature', $r['feature']->value)->assertJsonPath('current', $r['limite']);
    expect($r['compter']($this->org))->toBe($r['limite'])->and(L::dans($this->org, fn () => $objet->fresh()?->archived_at))->not->toBeNull();

    Q::deroger($this->org, $r['feature'], $r['limite'] + 1);
    Q::comme($this, $this->titulaire)->deleteJson($url)->assertOk();
    expect($r['compter']($this->org))->toBe($r['limite'] + 1);
    Q::comme($this, $this->titulaire)->deleteJson($url)->assertOk();
})->with([['lots', Unit::class], ['baux', Lease::class]]);

it('restaure sous la limite sans dérogation', function (string $nom): void {
    $r = Q::ressources()[$nom];
    $objet = $r['ajouter']($this->org);
    L::dans($this->org, fn () => $objet->forceFill(['archived_at' => now()])->save());
    Q::gratuit($this->org);

    Q::comme($this, $this->titulaire)->deleteJson(P::url($this->org, "{$r['lire']}/{$objet->id}/archive"))->assertOk();
    expect($r['compter']($this->org))->toBe(1);
})->with(['lots', 'baux']);

it('refuse la duplication d\'un bail à la limite', function (): void {
    $r = Q::ressources()['baux'];
    $source = D::creer($this->org, D::payload(L::lot($this->org), L::partie($this->org)));
    Q::gratuit($this->org);
    Q::remplir($this->org, $r, $r['limite']);

    Q::comme($this, $this->titulaire)->postJson(P::url($this->org, "/leases/{$source->id}/duplicate"), ['starts_on' => '2027-01-01'])
        ->assertStatus(409)->assertJsonPath('code', 'plan_quota_reached')->assertJsonPath('feature', 'leases');
    expect($r['compter']($this->org))->toBe($r['limite']);
});

it('échoue fermé sans organisation courante : actions plafonnées et middleware entitled', function (): void {
    app()->forgetInstance(CurrentOrganization::class);
    $donnees = new NewUnitData(fake()->uuid(), null, fake()->uuid(), 'X', null, null, [], [], []);
    $archive = (new Unit)->forceFill(['id' => fake()->uuid(), 'property_id' => fake()->uuid(), 'archived_at' => now()]);
    $bailArchive = (new Lease)->forceFill(['id' => fake()->uuid(), 'archived_at' => now()]);

    expect(fn () => app(CreateUnit::class)->handle($donnees))->toThrow(MissingOrganizationContext::class)
        ->and(fn () => app(RestoreUnit::class)->handle($archive))->toThrow(MissingOrganizationContext::class)
        ->and(fn () => app(RestoreLease::class)->handle($bailArchive))->toThrow(MissingOrganizationContext::class)
        ->and(fn () => app(RequireEntitlement::class)->handle(Request::create('/', 'POST'), fn () => response('ok'), 'leases'))->toThrow(MissingOrganizationContext::class);
});

it('applique entitled aux écritures seulement : une fonction désactivée bloque la création, jamais la lecture', function (): void {
    Q::deroger($this->org, Feature::Leases, null, false);
    $contexte = app(CurrentOrganization::class);
    $contexte->set($this->org->id);
    $suite = fn () => response('ok');

    expect(app(RequireEntitlement::class)->handle(Request::create('/', 'GET'), $suite, 'leases')->getContent())->toBe('ok')
        ->and(fn () => app(RequireEntitlement::class)->handle(Request::create('/', 'POST'), $suite, 'leases'))
        ->toThrow(fn (ApiProblem $p) => expect([$p->problemCode, $p->status, $p->extensions])->toBe(['feature_not_in_plan', 403, ['feature' => 'leases']]));
    expect(DB::table('subscriptions')->count())->toBe(2);
});
