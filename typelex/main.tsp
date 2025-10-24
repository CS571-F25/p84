import "@typelex/emitter";
import "./externals.tsp";

namespace com.deckbelcher.profile {
  /** My profile. */
  @rec("literal:self")
  model Main {
    /** Free-form profile description.*/
    @maxGraphemes(256)
    description?: string;
  }
}
