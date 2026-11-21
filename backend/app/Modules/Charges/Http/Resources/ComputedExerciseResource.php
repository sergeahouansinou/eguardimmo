<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Resources;

use App\Modules\Charges\Queries\Exercises;
use App\Modules\Charges\Support\ComputedExercise;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property ComputedExercise $resource
 */
final class ComputedExerciseResource extends JsonResource
{
    public static $wrap = 'data';

    public function __construct(ComputedExercise $resultat, private readonly Exercises $exercices)
    {
        parent::__construct($resultat);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;

        return (new ExerciseResource($r->exercise, $this->exercices->view($r->exercise)))->toArray($request) + ['excluded_leases' => $r->excluded];
    }
}
