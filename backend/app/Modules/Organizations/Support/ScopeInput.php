<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Data\MemberScopeData;
use App\Modules\Organizations\Enums\ScopeType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ScopeInput
{
    public const MAX_BIENS = 200;

    /**
     * @return array<string, list<mixed>>
     */
    public static function rules(string $presence): array
    {
        return [
            'scope' => [$presence, 'array:type,property_ids'],
            'scope.type' => ['required_with:scope', Rule::enum(ScopeType::class)],
            'scope.property_ids' => ['exclude_unless:scope.type,selected', 'nullable', 'array', 'max:'.self::MAX_BIENS],
            'scope.property_ids.*' => ['uuid', 'distinct'],
        ];
    }

    public static function from(FormRequest $request): ?MemberScopeData
    {
        if (! $request->has('scope')) {
            return null;
        }

        $type = ScopeType::from((string) $request->string('scope.type'));
        /** @var list<string> $biens */
        $biens = $type === ScopeType::Selected ? array_values(array_map(strval(...), (array) $request->input('scope.property_ids', []))) : [];

        return new MemberScopeData($type, $biens);
    }
}
