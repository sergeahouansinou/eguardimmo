<?php

declare(strict_types=1);

use App\Modules\Catalog\Actions\AttachTags;
use App\Modules\Catalog\Actions\UpdateCustomField;
use App\Modules\Catalog\Data\CustomFieldChangesData;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\Models\Tag;
use App\Modules\Catalog\Models\Tagging;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Support\ConcurrentWrite;
use App\Modules\Catalog\Support\TagSlug;
use App\Shared\Http\ApiProblem;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Catalog\CatalogContext as C;

beforeEach(function (): void {
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
});

function catalogueConcurrent(string $modele, Closure $insertion): void
{
    $fait = false;

    $modele::creating(function () use (&$fait, $insertion): void {
        if (! $fait) {
            $fait = true;
            $insertion();
        }
    });
}

it('interdit en base deux valeurs de la plateforme de même clé, ce que NULL laisse passer en unicité simple', function (): void {
    $ligne = ['id' => (string) Str::uuid7(), 'organization_id' => null, 'vocabulary' => 'unit_type', 'key' => 'duplex', 'labels' => '{"fr":"Duplex"}', 'created_at' => now(), 'updated_at' => now()];
    DB::table('terms')->insert($ligne);

    expect(fn () => DB::table('terms')->insert([...$ligne, 'id' => (string) Str::uuid7()]))->toThrow(UniqueConstraintViolationException::class);

    DB::table('terms')->insert([...$ligne, 'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id]);

    expect(DB::table('terms')->where('key', 'duplex')->count())->toBe(2);
});

it('interdit en base une pose d\'étiquette dont l\'organisation n\'est pas celle de l\'étiquette', function (): void {
    $etiquette = C::dans($this->org, fn () => Tag::factory()->create(['name' => 'Vacant', 'slug' => 'vacant']));
    $autre = C::organisation();

    DB::table('taggings')->insert([
        'id' => (string) Str::uuid7(), 'organization_id' => $autre->id, 'tag_id' => $etiquette->id,
        'taggable_type' => 'organization', 'taggable_id' => $autre->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
})->throws(QueryException::class);

it('répond 409 quand une valeur de même clé s\'écrit entre la vérification et l\'insertion', function (): void {
    $this->actingAs($this->titulaire);
    catalogueConcurrent(Term::class, fn () => DB::table('terms')->insert([
        'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'vocabulary' => 'unit_type', 'key' => 'course',
        'labels' => '{"fr":"Concurrente"}', 'created_at' => now(), 'updated_at' => now(),
    ]));

    $this->postJson(C::url($this->org, '/vocabularies/unit_type/terms'), ['key' => 'course', 'labels' => ['fr' => 'Course'], 'semantic_key' => 'residential'])
        ->assertConflict()->assertJsonPath('code', 'term_key_taken');
});

it('répond 409 quand une étiquette ou un champ de même nom s\'écrit entre la vérification et l\'insertion', function (): void {
    $this->actingAs($this->titulaire);
    $horodatage = ['created_at' => now(), 'updated_at' => now()];

    catalogueConcurrent(Tag::class, fn () => DB::table('tags')->insert([...$horodatage, 'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'name' => 'Vacant', 'slug' => 'vacant']));
    $this->postJson(C::url($this->org, '/tags'), ['name' => 'Vacant'])->assertConflict()->assertJsonPath('code', 'tag_name_taken');

    catalogueConcurrent(CustomFieldDefinition::class, fn () => DB::table('custom_field_definitions')->insert([
        ...$horodatage, 'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'entity' => 'unit', 'key' => 'parking', 'labels' => '{"fr":"P"}', 'type' => 'text',
    ]));
    $this->postJson(C::url($this->org, '/custom-fields/unit'), ['key' => 'parking', 'labels' => ['fr' => 'Parking'], 'type' => 'text'])
        ->assertConflict()->assertJsonPath('code', 'custom_field_key_taken');
});

it('répond 409 au renommage d\'une étiquette vers un nom pris entre la vérification et l\'écriture', function (): void {
    $this->actingAs($this->titulaire);
    $id = $this->postJson(C::url($this->org, '/tags'), ['name' => 'Loué'])->json('data.id');
    $fait = false;

    Tag::updating(function () use (&$fait): void {
        if (! $fait) {
            $fait = true;
            DB::table('tags')->insert(['id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'name' => 'Vacant', 'slug' => 'vacant', 'created_at' => now(), 'updated_at' => now()]);
        }
    });

    $this->putJson(C::url($this->org, "/tags/{$id}"), ['name' => 'Vacant'])->assertConflict()->assertJsonPath('code', 'tag_name_taken');
});

it('pose une étiquette déjà posée par une écriture simultanée sans échouer', function (): void {
    [$etiquette, $cible] = C::dans($this->org, fn () => [Tag::factory()->create(['name' => 'Vacant', 'slug' => 'vacant']), $this->org->id]);

    catalogueConcurrent(Tagging::class, fn () => DB::table('taggings')->insert([
        'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'tag_id' => $etiquette->id,
        'taggable_type' => 'organization', 'taggable_id' => $cible, 'created_at' => now(), 'updated_at' => now(),
    ]));

    expect(fn () => C::dans($this->org, fn () => app(AttachTags::class)->handle('organization', $cible, [$etiquette->id])))->not->toThrow(Throwable::class);
});

it('rejoue une fois une écriture qui échoue sur l\'unicité, et laisse remonter un second échec', function (): void {
    $appels = 0;
    $violation = fn () => new UniqueConstraintViolationException('sqlite', 'insert', [], new PDOException('UNIQUE'));

    $resultat = ConcurrentWrite::replayOnce(function () use (&$appels, $violation): string {
        if (++$appels === 1) {
            throw $violation();
        }

        return 'ok';
    });

    expect($resultat)->toBe('ok')->and($appels)->toBe(2)
        ->and(fn () => ConcurrentWrite::replayOnce(fn () => throw $violation()))->toThrow(UniqueConstraintViolationException::class);
});

it('donne un slug stable aux noms sans équivalent latin au lieu d\'un slug vide', function (): void {
    expect(TagSlug::of('Rénovation'))->toBe('renovation')
        ->and(TagSlug::of('日本語'))->toStartWith('t-')->and(TagSlug::of('日本語'))->toBe(TagSlug::of(' 日本語 '))
        ->and(TagSlug::of('日本語'))->not->toBe(TagSlug::of('ᏣᎳᎩ'));

    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/tags');

    $this->postJson($url, ['name' => '日本語'])->assertCreated();
    $this->postJson($url, ['name' => 'ᏣᎳᎩ'])->assertCreated();
    $this->postJson($url, ['name' => '日本語'])->assertConflict()->assertJsonPath('code', 'tag_name_taken');
});

it('contrôle le gel du type sous verrou, sur la valeur courante et non sur le modèle lu avant', function (): void {
    $champ = C::dans($this->org, fn () => CustomFieldDefinition::factory()->create(['key' => 'code', 'type' => CustomFieldType::Text]));
    DB::table('custom_field_definitions')->where('id', $champ->id)->update(['values_recorded_at' => now()]);

    $appel = fn () => C::dans($this->org, fn () => app(UpdateCustomField::class)->handle($champ, new CustomFieldChangesData(type: CustomFieldType::Number)));

    expect($appel)->toThrow(fn (ApiProblem $probleme) => expect($probleme->problemCode)->toBe(ErrorCode::CustomFieldTypeLocked->value));
});
