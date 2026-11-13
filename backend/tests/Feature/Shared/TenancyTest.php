<?php

declare(strict_types=1);

use App\Shared\Tenancy\AcrossOrganizations;
use App\Shared\Tenancy\CurrentOrganization;
use App\Shared\Tenancy\MissingOrganizationContext;
use App\Shared\Tenancy\OrganizationMismatch;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Fixtures\Tenancy\Document;

beforeEach(function (): void {
    Schema::create('documents_tenancy_test', function (Blueprint $table): void {
        $table->id();
        $table->unsignedBigInteger('organization_id');
        $table->string('titre');
    });

    DB::table('documents_tenancy_test')->insert([
        ['organization_id' => 1, 'titre' => 'A1'],
        ['organization_id' => 1, 'titre' => 'A2'],
        ['organization_id' => 2, 'titre' => 'B1'],
    ]);
});

afterEach(function (): void {
    Schema::dropIfExists('documents_tenancy_test');
});

it('ne lit que les lignes de l\'organisation courante', function (): void {
    app(CurrentOrganization::class)->set(1);

    expect(Document::query()->orderBy('id')->pluck('titre')->all())->toBe(['A1', 'A2']);
});

it('rend invisible par find une ligne d\'une autre organisation', function (): void {
    app(CurrentOrganization::class)->set(1);
    $autre = (int) DB::table('documents_tenancy_test')->where('titre', 'B1')->value('id');
    $propre = (int) DB::table('documents_tenancy_test')->where('titre', 'A1')->value('id');

    expect(Document::query()->find($autre))->toBeNull()
        ->and(Document::query()->find($propre)?->titre)->toBe('A1');
});

it('refuse toute requête sans contexte', function (): void {
    Document::query()->get();
})->throws(MissingOrganizationContext::class);

it('remplit organization_id depuis le contexte à la création', function (): void {
    app(CurrentOrganization::class)->set(2);

    $document = Document::query()->create(['titre' => 'B2']);

    expect($document->organization_id)->toBe(2)
        ->and((int) DB::table('documents_tenancy_test')->where('titre', 'B2')->value('organization_id'))->toBe(2);
});

it('accepte une création avec l\'organisation courante explicite', function (): void {
    app(CurrentOrganization::class)->set(1);

    expect(Document::query()->create(['titre' => 'A3', 'organization_id' => 1])->organization_id)->toBe(1);
});

it('refuse une création pour une autre organisation', function (): void {
    app(CurrentOrganization::class)->set(1);

    Document::query()->create(['titre' => 'X', 'organization_id' => 2]);
})->throws(OrganizationMismatch::class);

it('refuse une création sans contexte', function (): void {
    Document::query()->create(['titre' => 'X']);
})->throws(MissingOrganizationContext::class);

it('refuse de modifier organization_id', function (): void {
    app(CurrentOrganization::class)->set(1);
    $document = Document::query()->where('titre', 'A1')->firstOrFail();

    $document->organization_id = 2;
    $document->save();
})->throws(OrganizationMismatch::class);

it('autorise la modification des autres champs', function (): void {
    app(CurrentOrganization::class)->set(1);
    $document = Document::query()->where('titre', 'A1')->firstOrFail();

    $document->update(['titre' => 'A1 bis']);

    expect(DB::table('documents_tenancy_test')->where('titre', 'A1 bis')->value('organization_id'))->toBe(1);
});

it('refuse de fixer deux organisations différentes', function (): void {
    app(CurrentOrganization::class)->set(1);
    app(CurrentOrganization::class)->set(2);
})->throws(OrganizationMismatch::class);

it('tolère set répété avec le même id', function (): void {
    app(CurrentOrganization::class)->set(1);
    app(CurrentOrganization::class)->set(1);

    expect(app(CurrentOrganization::class)->id())->toBe(1)
        ->and(app(CurrentOrganization::class)->has())->toBeTrue();
});

it('signale l\'absence de contexte', function (): void {
    expect(app(CurrentOrganization::class)->has())->toBeFalse();

    app(CurrentOrganization::class)->id();
})->throws(MissingOrganizationContext::class);

it('run pose temporairement une autre organisation puis restaure l\'état précédent', function (): void {
    app(CurrentOrganization::class)->set(1);

    $titres = app(CurrentOrganization::class)->run(2, fn (): array => Document::query()->pluck('titre')->all());

    expect($titres)->toBe(['B1'])
        ->and(app(CurrentOrganization::class)->id())->toBe(1);
});

it('run restaure l\'état précédent après une exception', function (): void {
    app(CurrentOrganization::class)->set(1);

    try {
        app(CurrentOrganization::class)->run(2, fn () => throw new RuntimeException('boom'));
    } catch (RuntimeException) {
    }

    expect(app(CurrentOrganization::class)->id())->toBe(1);
});

it('run restaure l\'absence de contexte', function (): void {
    try {
        app(CurrentOrganization::class)->run(2, fn () => throw new RuntimeException('boom'));
    } catch (RuntimeException) {
    }

    expect(app(CurrentOrganization::class)->has())->toBeFalse();
});

it('AcrossOrganizations voit toutes les organisations, même sans contexte', function (): void {
    expect(AcrossOrganizations::query(Document::class)->count())->toBe(3);

    app(CurrentOrganization::class)->set(1);

    expect(AcrossOrganizations::query(Document::class)->count())->toBe(3)
        ->and(Document::query()->count())->toBe(2);
});
