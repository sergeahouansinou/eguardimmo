<?php

declare(strict_types=1);

use App\Modules\Catalog\Models\Tag;
use App\Modules\Catalog\Models\Tagging;
use App\Modules\Catalog\PublicApi\Tagger;
use App\Shared\Http\ApiProblem;
use Tests\Feature\Catalog\CatalogContext as C;

beforeEach(function (): void {
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
});

it('protège les étiquettes : 401, 404 hors organisation, 403 pour un gestionnaire en écriture', function (): void {
    $url = C::url($this->org, '/tags');

    $this->getJson($url)->assertUnauthorized();
    $this->postJson($url, ['name' => 'Vacant'])->assertUnauthorized();

    $this->actingAs(C::titulaire(C::organisation()))->getJson($url)->assertNotFound();

    C::changerDeCompte($this, C::gestionnaire($this->org))->getJson($url)->assertOk();
    $this->postJson($url, ['name' => 'Vacant'])->assertForbidden();
    $this->putJson("{$url}/".fake()->uuid(), ['name' => 'X'])->assertForbidden();
    $this->deleteJson("{$url}/".fake()->uuid())->assertForbidden();
});

it('crée, liste par curseur, renomme et supprime des étiquettes', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/tags');

    $id = $this->postJson($url, ['name' => 'A renover', 'color' => '#FF8800'])
        ->assertCreated()
        ->assertJsonPath('data.name', 'A renover')
        ->assertJsonPath('data.slug', 'a-renover')
        ->assertJsonPath('data.color', '#ff8800')
        ->json('data.id');
    $this->postJson($url, ['name' => 'Vacant'])->assertCreated();
    $this->postJson($url, ['name' => 'Prioritaire'])->assertCreated();

    $page = $this->getJson("{$url}?per_page=2")->assertOk()->assertJsonCount(2, 'data');
    expect($page->json('data.*.name'))->toBe(['A renover', 'Prioritaire']);
    $suite = $this->getJson($url.'?per_page=2&cursor='.$page->json('meta.next_cursor'))->assertOk()->assertJsonCount(1, 'data');
    expect($suite->json('data.0.name'))->toBe('Vacant');
    $this->getJson("{$url}?cursor=n-importe-quoi")->assertUnprocessable();

    $this->putJson("{$url}/{$id}", ['name' => 'Rénovation', 'color' => null])->assertOk()->assertJsonPath('data.slug', 'renovation')->assertJsonPath('data.color', null);
    $this->deleteJson("{$url}/{$id}")->assertNoContent();
    expect(C::dans($this->org, fn () => Tag::query()->count()))->toBe(2);
});

it('refuse un nom déjà pris, vide ou une couleur invalide', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/tags');

    $this->postJson($url, ['name' => 'Vacant'])->assertCreated();
    $this->postJson($url, ['name' => 'vacant'])->assertConflict()->assertJsonPath('code', 'tag_name_taken');
    $autre = $this->postJson($url, ['name' => 'Loué'])->json('data.id');
    $this->putJson("{$url}/{$autre}", ['name' => ' VACANT '])->assertConflict();
    $this->putJson("{$url}/{$autre}", ['name' => 'Loué'])->assertOk();

    $this->postJson($url, ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->postJson($url, ['name' => '!!!'])->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->postJson($url, ['name' => 'Rouge', 'color' => 'rouge'])->assertUnprocessable()->assertJsonValidationErrors('color');
});

it('isole les étiquettes par organisation', function (): void {
    $this->actingAs($this->titulaire);
    $id = $this->postJson(C::url($this->org, '/tags'), ['name' => 'Vacant'])->json('data.id');

    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre));
    $this->getJson(C::url($autre, '/tags'))->assertOk()->assertJsonCount(0, 'data');
    $this->putJson(C::url($autre, "/tags/{$id}"), ['name' => 'Piraté'])->assertNotFound()->assertJsonPath('code', 'tag_not_found');
    $this->deleteJson(C::url($autre, "/tags/{$id}"))->assertNotFound();
    $this->postJson(C::url($autre, '/tags'), ['name' => 'Vacant'])->assertCreated();
});

it('pose, lit et retire des étiquettes sur un objet par la PublicApi', function (): void {
    $tagger = app(Tagger::class);
    $objet = $this->org->id;

    $ids = C::dans($this->org, function () use ($tagger, $objet): array {
        $ids = [Tag::factory()->create(['name' => 'Vacant', 'slug' => 'vacant'])->id, Tag::factory()->create(['name' => 'Alpha', 'slug' => 'alpha'])->id];

        $tagger->attach('organization', $objet, $ids);
        $tagger->attach('organization', $objet, [$ids[0]]);

        expect(array_map(fn ($e) => $e->name, $tagger->tagsOf('organization', $objet)))->toBe(['Alpha', 'Vacant'])
            ->and(Tagging::query()->count())->toBe(2);

        $tagger->detach('organization', $objet, [$ids[0]]);

        expect(array_map(fn ($e) => $e->name, $tagger->tagsOf('organization', $objet)))->toBe(['Alpha']);

        return $ids;
    });

    $this->actingAs($this->titulaire)->deleteJson(C::url($this->org, "/tags/{$ids[1]}"))->assertNoContent();
    expect(C::dans($this->org, fn () => Tagging::query()->count()))->toBe(0);
});

it('refuse l\'étiquette d\'une autre organisation et un alias hors morph map', function (): void {
    $autre = C::organisation();
    $etrangere = C::dans($autre, fn (): string => Tag::factory()->create()->id);
    $tagger = app(Tagger::class);

    C::dans($this->org, function () use ($tagger, $etrangere): void {
        try {
            $tagger->attach('organization', $this->org->id, [$etrangere]);
            $code = null;
        } catch (ApiProblem $probleme) {
            $code = $probleme->problemCode;
        }

        expect($code)->toBe('tag_not_found')
            ->and(fn () => $tagger->attach('inconnu', $this->org->id, []))->toThrow(InvalidArgumentException::class);
    });
});
